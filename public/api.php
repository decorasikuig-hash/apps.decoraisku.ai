<?php
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * LuxeLiving ERP - Hostinger Database Bridge API v1.0
 * 
 * CARA DEPLOY DI HOSTINGER:
 * 1. Build aplikasi React ini (npm run build).
 * 2. Unggah isi folder "dist/" (termasuk file api.php ini) ke folder "public_html" Hostinger Anda.
 * 3. Jika ingin menggunakan database MySQL Hostinger:
 *    - Buat database MySQL di Hostinger hPanel.
 *    - Buat user database baru dan hubungkan ke database tersebut.
 *    - Isi kredensial DB_HOST, DB_USER, DB_PASSWORD, DB_NAME di bawah ini.
 * 4. Jika dibiarkan kosong, sistem otomatis menggunakan "Mode File JSON Aman" (.ht_erp_database.json).
 */

// --- KONFIGURASI DATABASE MYSQL HOSTINGER ---
define('DB_HOST', 'localhost'); // Biasanya 'localhost' di Hostinger
define('DB_USER', 'u133770199_root');          // Username database Hostinger
define('DB_PASSWORD', 'Taurus3**4');      // Password database Hostinger
define('DB_NAME', 'u133770199_db');          // Nama database Hostinger

// --- PENGATURAN HEADER & CORS SECURITY ---
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// Tangani Request Preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Lokasi backup file database lokal aman jika tidak memakai MySQL
// Menggunakan awalan ".ht_" agar diblokir otomatis oleh Apache/Hostinger dari akses publik langsung
// Proteksi Tambahan: Simpan berkas database di satu tingkat (level) di atas folder public_html/dist
// agar tidak terhapus saat folder public_html dibersihkan / di-overwrite waktu upload file 'dist' baru.
$parent_dir = dirname(__DIR__);
if (is_writable($parent_dir)) {
    define('JSON_DB_FILE', $parent_dir . '/.ht_erp_database.json');
} else {
    define('JSON_DB_FILE', __DIR__ . '/.ht_erp_database.json');
}

// Helper untuk menggabungkan dua array koleksi berdasarkan ID agar tidak menimpa / menghapus data yang ada di Hostinger
function merge_collection_arrays($local_arr, $incoming_arr) {
    if (!is_array($local_arr)) return is_array($incoming_arr) ? $incoming_arr : [];
    if (!is_array($incoming_arr)) return is_array($local_arr) ? $local_arr : [];

    $map = [];
    
    $get_key = function($item) {
        if (!is_array($item)) return '';
        if (isset($item['id'])) return $item['id'];
        if (isset($item['uid'])) return $item['uid'];
        if (isset($item['code'])) return $item['code'];
        if (isset($item['plateNumber'])) return $item['plateNumber'];
        return '';
    };

    foreach ($local_arr as $item) {
        $key = $get_key($item);
        if ($key !== '') {
            $map[$key] = $item;
        } else {
            $map[] = $item;
        }
    }

    foreach ($incoming_arr as $item) {
        $key = $get_key($item);
        if ($key !== '') {
            if (isset($map[$key])) {
                $local_item = $map[$key];
                $local_time = isset($local_item['lastUpdated']) ? $local_item['lastUpdated'] : (isset($local_item['timestamp']) ? $local_item['timestamp'] : (isset($local_item['date']) ? $local_item['date'] : ''));
                $incoming_time = isset($item['lastUpdated']) ? $item['lastUpdated'] : (isset($item['timestamp']) ? $item['timestamp'] : (isset($item['date']) ? $item['date'] : ''));
                
                if (empty($incoming_time) || empty($local_time) || $incoming_time >= $local_time) {
                    $map[$key] = $item;
                }
            } else {
                $map[$key] = $item;
            }
        } else {
            $map[] = $item;
        }
    }

    return array_values($map);
}

// Jalankan Routing Aksi
$action = isset($_GET['action']) ? $_GET['action'] : 'ping';

try {
    $db = null;
    $use_mysql = (!empty(DB_NAME) && !empty(DB_USER));

    if ($use_mysql) {
        $db = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
        if ($db->connect_error) {
            throw new Exception("Sambungan MySQL gagal: " . $db->connect_error);
        }
        
        // Buat tabel audit penyimpanan koleksi otomatis jika belum ada
        $db->query("CREATE TABLE IF NOT EXISTS erp_db_store (
            key_name VARCHAR(100) PRIMARY KEY,
            data_val LONGTEXT NOT NULL,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    }

    switch ($action) {
        case 'ping':
            echo json_encode([
                "status" => "ok",
                "message" => "LuxeLiving ERP Hostinger Bridge aktif!",
                "timestamp" => date('Y-m-d H:i:s'),
                "mode" => $use_mysql ? "MYSQL_DATABASE" : "JSON_SECURE_FILE",
                "write_perm" => is_writable(__DIR__),
                "db_connected" => $use_mysql ? true : false,
                "json_file_exists" => file_exists(JSON_DB_FILE)
            ]);
            break;

        case 'get_state':
            if ($use_mysql) {
                // Tarik data per baris key dan susun dalam objek state tunggal
                $res = $db->query("SELECT * FROM erp_db_store");
                $state = [];
                while ($row = $res->fetch_assoc()) {
                    $key = str_replace('erp_', '', $row['key_name']);
                    $state[$key] = json_decode($row['data_val'], true);
                }
                
                // Jika MySQL masih kosong, kembalikan kosong agar di-seed oleh klien
                echo json_encode(["status" => "success", "data" => $state]);
            } else {
                if (file_exists(JSON_DB_FILE)) {
                    $raw = file_get_contents(JSON_DB_FILE);
                    echo json_encode([
                        "status" => "success",
                        "data" => json_decode($raw, true)
                    ]);
                } else {
                    echo json_encode(["status" => "success", "data" => null, "info" => "Database masih kosong belum terekam"]);
                }
            }
            break;

        case 'save_state':
            // Simpan seluruh state database secara massal (merge dengan yang sudah ada)
            $raw_input = file_get_contents('php://input');
            $data = json_decode($raw_input, true);
            
            if (!$data || !is_array($data)) {
                throw new Exception("Format payload tidak valid. Harus objek JSON relasional.");
            }

            if ($use_mysql) {
                $db->begin_transaction();
                // Iterasi setiap collection utama dan simpan ke mysql setelah merge
                foreach ($data as $key => $val) {
                    $key_name = 'erp_' . $db->real_escape_string($key);
                    
                    // Fetch existing first to avoid deleting what already exists
                    $existing_val = '';
                    $sel = $db->prepare("SELECT data_val FROM erp_db_store WHERE key_name = ?");
                    $sel->bind_param("s", $key_name);
                    $sel->execute();
                    $sel->bind_result($existing_val);
                    $sel->fetch();
                    $sel->close();

                    $existing_items = json_decode($existing_val, true) ?: [];
                    if ($key === 'settings') {
                        $merged = array_merge($existing_items, $val);
                    } else {
                        $merged = merge_collection_arrays($existing_items, $val);
                    }

                    $data_val = $db->real_escape_string(json_encode($merged));
                    
                    $stmt = $db->prepare("INSERT INTO erp_db_store (key_name, data_val) VALUES (?, ?) 
                                          ON DUPLICATE KEY UPDATE data_val = VALUES(data_val)");
                    $stmt->bind_param("ss", $key_name, $data_val);
                    $stmt->execute();
                    $stmt->close();
                }
                $db->commit();
                echo json_encode(["status" => "success", "message" => "Seluruh koleksi digabungkan & diunggah aman ke MySQL Hostinger."]);
            } else {
                $current_state = [];
                if (file_exists(JSON_DB_FILE)) {
                    $current_state = json_decode(file_get_contents(JSON_DB_FILE), true) ?: [];
                }
                foreach ($data as $key => $val) {
                    $existing_items = isset($current_state[$key]) ? $current_state[$key] : [];
                    if ($key === 'settings') {
                        $merged = array_merge((array)$existing_items, (array)$val);
                    } else {
                        $merged = merge_collection_arrays($existing_items, $val);
                    }
                    $current_state[$key] = $merged;
                }

                $ok = file_put_contents(JSON_DB_FILE, json_encode($current_state, JSON_PRETTY_PRINT));
                if ($ok === false) {
                    throw new Exception("Gagal menulis ke berkas .ht_erp_database.json. Periksa izin tulis (permissions) folder public_html Hostinger Anda.");
                }
                echo json_encode(["status" => "success", "message" => "Seluruh draf aman digabungkan di penyimpanan berkas lokal."]);
            }
            break;

        case 'save_collection':
            // Simpan satu koleksi spesifik
            $key = isset($_GET['key']) ? $_GET['key'] : '';
            $overwrite = isset($_GET['overwrite']) ? $_GET['overwrite'] === '1' : false;
            if (empty($key)) {
                throw new Exception("Parameter 'key' koleksi dibutuhkan.");
            }

            $raw_input = file_get_contents('php://input');
            $decoded_items = json_decode($raw_input, true);

            if ($decoded_items === null) {
                throw new Exception("Format data koleksi tidak valid.");
            }

            if ($use_mysql) {
                $key_name = 'erp_' . $db->real_escape_string($key);
                
                if ($overwrite) {
                    $merged = $decoded_items;
                } else {
                    // Fetch existing first to avoid deleting what already exists
                    $existing_val = '';
                    $sel = $db->prepare("SELECT data_val FROM erp_db_store WHERE key_name = ?");
                    $sel->bind_param("s", $key_name);
                    $sel->execute();
                    $sel->bind_result($existing_val);
                    $sel->fetch();
                    $sel->close();

                    $existing_items = json_decode($existing_val, true) ?: [];
                    if ($key === 'settings') {
                        $merged = array_merge($existing_items, $decoded_items);
                    } else {
                        $merged = merge_collection_arrays($existing_items, $decoded_items);
                    }
                }

                $stmt = $db->prepare("INSERT INTO erp_db_store (key_name, data_val) VALUES (?, ?) 
                                      ON DUPLICATE KEY UPDATE data_val = ?");
                $json_encoded = json_encode($merged);
                $stmt->bind_param("sss", $key_name, $json_encoded, $json_encoded);
                $stmt->execute();
                $stmt->close();
                
                echo json_encode(["status" => "success", "message" => "Koleksi '$key' berhasil digabungkan otomatis ke Hostinger MySQL."]);
            } else {
                // Sinkronisasi parsial via File JSON
                $current_state = [];
                if (file_exists(JSON_DB_FILE)) {
                    $current_state = json_decode(file_get_contents(JSON_DB_FILE), true) ?: [];
                }
                
                if ($overwrite) {
                    $merged = $decoded_items;
                } else {
                    $existing_items = isset($current_state[$key]) ? $current_state[$key] : [];
                    if ($key === 'settings') {
                        $merged = array_merge((array)$existing_items, (array)$decoded_items);
                    } else {
                        $merged = merge_collection_arrays($existing_items, $decoded_items);
                    }
                }
                $current_state[$key] = $merged;
                
                $ok = file_put_contents(JSON_DB_FILE, json_encode($current_state, JSON_PRETTY_PRINT));
                if ($ok === false) {
                    throw new Exception("Gagal mengupdate berkas database.");
                }
                echo json_encode(["status" => "success", "message" => "Koleksi '$key' aman digabungkan ke File Hostinger."]);
            }
            break;

        default:
            throw new Exception("Aksi '$action' tidak dikenali.");
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
}

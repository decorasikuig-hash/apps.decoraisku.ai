import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  console.log(`Starting server, NODE_ENV: ${process.env.NODE_ENV}`);
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini Setup
  let ai: GoogleGenAI | null = null;
  const getAi = () => {
    if (!ai) {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not defined");
      }
      ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return ai;
  };

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/scrape-wa-catalog", async (req, res) => {
    let { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // Ensure URL has protocol
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }

    // Normalize wa.me/c link to direct catalog link if possible
    let fetchUrl = url;
    const waMeMatch = url.match(/wa\.me\/c\/(\d+)/);
    if (waMeMatch) {
      const phoneNumber = waMeMatch[1];
      fetchUrl = `https://www.whatsapp.com/catalog/${phoneNumber}/?lang=id`;
    }

    const commonHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    };

    let resp;
    try {
      console.log(`Scraping WA Catalog from: ${fetchUrl}`);
      
      resp = await fetch(fetchUrl, {
        headers: commonHeaders,
        redirect: 'follow'
      });

      if (!resp.ok) {
        console.error(`Fetch failed for ${fetchUrl}: ${resp.status} ${resp.statusText}`);
        
        // Retry with original URL if normalized failed
        if (fetchUrl !== url) {
            console.log("Retrying with original URL...");
            resp = await fetch(url, { headers: commonHeaders, redirect: 'follow' });
        }
        
        if (!resp.ok) {
           throw new Error(`WhatsApp rejected connection (${resp.status}). Link mungkin diproteksi oleh Meta.`);
        }
      }

      const html = await resp.text();

      // Extract specifically the data scripts
      const allScripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
      
      let extractionContext = "";
      
      // Look for LD+JSON with Product or ItemList first
      const productLdJson = allScripts.filter(s => 
        s.includes('application/ld+json') && 
        (s.includes('"Product"') || s.includes('"ItemList"'))
      );

      if (productLdJson.length > 0) {
        extractionContext = productLdJson.join("\n");
        console.log("Found Product/ItemList in LD+JSON");
      } else {
        // Look for __initialData or similar patterns (Meta's React hydration data)
        const dataScripts = allScripts.filter(s => 
          s.includes('__initialData') || 
          s.includes('catalog_data') || 
          s.includes('product_info')
        );
        if (dataScripts.length > 0) {
          extractionContext = dataScripts.join("\n").substring(0, 50000);
          console.log("Found data in script variables");
        } else {
          // Fallback to cleaned body if it's rendered HTML
          extractionContext = html.replace(/<style([\s\S]*?)<\/style>/g, '')
                                  .replace(/<script([\s\S]*?)<\/script>/g, '')
                                  .substring(0, 35000);
          console.log("Using fallback cleaned HTML");
        }
      }

      const prompt = `Ekstrak daftar produk lengkap dari data katalog WhatsApp Business berikut.
      
      Output harus berupa JSON ARRAY [{}, {}] dengan field:
      - name: Nama produk lengkap (Indonesia)
      - price: Angka saja (contoh: 5000000). Bersihkan format Rp atau titik.
      - description: Deskripsi produk.
      - imageUrl: Link gambar utama (cari di "image", "contentUrl", atau meta tags).
      - link: Link produk asli.
      - sku: Kode SKU jika ada.

      Berikan hanya JSON array tanpa teks tambahan.
      
      Data Sumber:
      ${extractionContext}
      `;

      const response = await getAi().models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const textOutput = response.text || "[]";
      let products = [];
      try {
        products = JSON.parse(textOutput);
      } catch (e) {
        console.error("JSON Parse error:", e);
        // Fallback for malformed JSON
        const match = textOutput.match(/\[[\s\S]*\]/);
        if (match) products = JSON.parse(match[0]);
      }

      console.log(`Successfully extracted ${products.length} products`);
      res.json({ products });

    } catch (error: any) {
      console.error("Scraping error:", error);
      res.status(500).json({ error: error.message || "Gagal mengambil katalog secara otomatis" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    console.log(`Serving static files, process.cwd(): ${process.cwd()}, distPath: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      console.log(`Req: ${req.url}`);
      const indexPath = path.join(distPath, 'index.html');
      console.log(`Sending index file from: ${indexPath}`);
      res.sendFile(indexPath);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server started successfully on port ${PORT}`);
  });
}

console.log("Starting server...");
startServer().catch(err => {
    console.error("Critical error starting server:", err);
    process.exit(1);
});

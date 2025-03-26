const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware to parse request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Route to serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle GET requests for proxied URLs
app.get('/fetch', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).send('URL parameter is required');
  }
  try {
    const decodedUrl = decodeURIComponent(url);
    // Instead of redirecting, fetch and process the content directly
    const response = await axios.get(decodedUrl);
    const html = response.data;
    const $ = cheerio.load(html);

    // Process text nodes in the body
    $('body *').contents().filter(function() {
      return this.nodeType === 3; // Text nodes only
    }).each(function() {
      const text = $(this).text();
      const newText = text.replace(/Yale/g, 'Fale').replace(/yale/g, 'fale');
      if (text !== newText) {
        $(this).replaceWith(newText);
      }
    });

    // Process title separately
    const title = $('title').text().replace(/Yale/g, 'Fale').replace(/yale/g, 'fale');
    $('title').text(title);

    // Update all links to route through our proxy
    $('a').each(function() {
      const href = $(this).attr('href');
      if (href) {
        // Handle relative URLs
        let absoluteUrl;
        if (href.startsWith('http')) {
          absoluteUrl = href;
        } else if (href.startsWith('//')) {
          absoluteUrl = 'http:' + href;
        } else if (href.startsWith('/')) {
          const urlObj = new URL(decodedUrl);
          absoluteUrl = urlObj.origin + href;
        } else {
          const urlObj = new URL(href, decodedUrl);
          absoluteUrl = urlObj.href;
        }
        // Encode the URL and update the href to use our proxy
        const encodedUrl = encodeURIComponent(absoluteUrl);
        $(this).attr('href', `/fetch?url=${encodedUrl}`);
      }
    });

    // Send the full HTML page
    res.send($.html());
  } catch (error) {
    res.status(500).send(`Error processing URL: ${error.message}`);
  }
});

// API endpoint to fetch and modify content
app.post('/fetch', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Fetch the content from the provided URL
    const response = await axios.get(url);
    const html = response.data;

    // Use cheerio to parse HTML and selectively replace text content
    const $ = cheerio.load(html);
    
    // Process text nodes in the body
    $('body *').contents().filter(function() {
      return this.nodeType === 3; // Text nodes only
    }).each(function() {
      const text = $(this).text();
      const newText = text.replace(/Yale/g, 'Fale').replace(/yale/g, 'fale');
      if (text !== newText) {
        $(this).replaceWith(newText);
      }
    });
    
    // Process title separately
    const title = $('title').text().replace(/Yale/g, 'Fale').replace(/yale/g, 'fale');
    $('title').text(title);

    // Update all links to route through our proxy
    $('a').each(function() {
      const href = $(this).attr('href');
      if (href) {
        // Handle relative URLs
        let absoluteUrl;
        if (href.startsWith('http')) {
          absoluteUrl = href;
        } else if (href.startsWith('//')) {
          absoluteUrl = 'http:' + href;
        } else if (href.startsWith('/')) {
          const urlObj = new URL(url);
          absoluteUrl = urlObj.origin + href;
        } else {
          const urlObj = new URL(href, url);
          absoluteUrl = urlObj.href;
        }
        // Encode the URL and update the href to use our proxy
        const encodedUrl = encodeURIComponent(absoluteUrl);
        $(this).attr('href', `/fetch?url=${encodedUrl}`);
      }
    });
    
    return res.json({ 
      success: true, 
      content: $.html(),
      title: title,
      originalUrl: url
    });
  } catch (error) {
    console.error('Error fetching URL:', error.message);
    return res.status(500).json({ 
      error: `Failed to fetch content: ${error.message}` 
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Faleproxy server running at http://localhost:${PORT}`);
});

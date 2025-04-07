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

// Helper function for Yale to Fale replacement that only affects nodes containing Yale
function replaceYaleWithFale(text) {
  // First check if the text contains Yale as a standalone word
  const hasStandaloneYale = /\b(YALE|Yale|yale)\b/.test(text);
  
  // If it doesn't have a standalone Yale, return the original text
  if (!hasStandaloneYale) {
    return text;
  }
  
  // Replace each instance of Yale with Fale while preserving case
  return text.replace(/\b(YALE|Yale|yale)\b/g, function(match) {
    if (match === 'YALE') return 'FALE';
    if (match === 'yale') return 'fale';
    return 'Fale';
  });
}

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
      const newText = replaceYaleWithFale(text);
      if (text !== newText) {
        $(this).replaceWith(newText);
      }
    });

    // Process title separately
    const title = $('title').text();
    const newTitle = replaceYaleWithFale(title);
    if (title !== newTitle) {
      $('title').text(newTitle);
    }

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
      const newText = replaceYaleWithFale(text);
      if (text !== newText) {
        $(this).replaceWith(newText);
      }
    });

    // Process title separately
    const title = $('title').text();
    const newTitle = replaceYaleWithFale(title);
    if (title !== newTitle) {
      $('title').text(newTitle);
    }

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
      title: newTitle,
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
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;

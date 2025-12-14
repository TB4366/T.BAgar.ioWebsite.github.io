require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

let catalog = { skins: [], emoji: [] };

// Laden van officiële Agar.io config
async function loadAgarConfig() {
    try {
        const res = await fetch('https://configs-web.agario.miniclippt.com/live/v15/10850/GameConfiguration.json');
        const data = await res.json();
        
        const skinsSet = new Set();
        const emojisSet = new Set();

        if(data && data.shopItems) {
            data.shopItems.forEach(item => {
                if(item.productId){
                    if(item.productId.startsWith('skin_')) skinsSet.add(item.productId);
                    if(item.productId.startsWith('emoji_')) emojisSet.add(item.productId);
                }
            });
        }

        catalog.skins = Array.from(skinsSet);
        catalog.emoji = Array.from(emojisSet);

        console.log(`Loaded ${catalog.skins.length} skins and ${catalog.emoji.length} emoji from Agar.io config`);
    } catch(err) {
        console.error('Fout bij het laden van Agar.io config:', err);
    }
}

// Initial load
loadAgarConfig();

// Endpoint voor frontend catalogus
app.get('/catalog', (req, res) => res.json(catalog));

// Payment endpoint
app.post('/create-payment', async (req, res) => {
    const { uid, item } = req.body;
    if(!uid || (!catalog.skins.includes(item) && !catalog.emoji.includes(item))) {
        return res.status(400).json({ error: 'Ongeldig UID of item' });
    }

    try {
        const response = await fetch(`https://api.xsolla.com/merchant/v2/merchants/${process.env.MERCHANT_ID}/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${Buffer.from(process.env.XSOLLA_API_KEY + ':').toString('base64')}`
            },
            body: JSON.stringify({
                user: { id: uid },
                settings: { currency: "USD", locale: "en" },
                purchase: { virtual_items: [{ sku: "agar_special_pack", amount: 1 }] },
                redirect: { success: "https://jouwsite.nl/success", cancel: "https://jouwsite.nl/cancel" }
            })
        });

        const data = await response.json();
        if(data && data.token){
            res.json({ paymentUrl: `https://secure.xsolla.com/paystation3/?access_token=${data.token}` });
        } else {
            res.status(500).json({ error: 'Kon token niet aanmaken', details: data });
        }
    } catch(err){
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.listen(PORT, () => console.log(`Server draait op http://localhost:${PORT}`));

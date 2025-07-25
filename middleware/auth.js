const authMiddleware = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(401).json({ 
            success: false,
            error: 'Invalid or missing API key' 
        });
    }
    
    next();
};

module.exports = { authMiddleware };

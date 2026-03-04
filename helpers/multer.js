const multer = require('multer')

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 } // 5MB max per image
})

module.exports = upload

// Diagnostica: risponde sempre, indica solo SE le variabili esistono (mai i valori)
module.exports = async (req, res) => {
  res.json({
    ok: true,
    node: process.version,
    variabili: {
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      NARAKEET_API_KEY: Boolean(process.env.NARAKEET_API_KEY),
      BLOB_READ_WRITE_TOKEN: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    },
  });
};
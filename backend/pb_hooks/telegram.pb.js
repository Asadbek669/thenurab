routerAdd("POST", "/api/telegram/profile", (e) => {
function utf8Bytes(text) {
  const bytes = []
  for (let i = 0; i < text.length; i++) {
    let codePoint = text.charCodeAt(i)
    if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1)
      if (low >= 0xdc00 && low <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (low - 0xdc00)
        i++
      }
    }
    if (codePoint <= 0x7f) {
      bytes.push(codePoint)
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f))
    } else if (codePoint <= 0xffff) {
      bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f))
    } else {
      bytes.push(0xf0 | (codePoint >> 18), 0x80 | ((codePoint >> 12) & 0x3f), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f))
    }
  }
  return bytes
}

function sha256Bytes(input) {
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]
  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
  const message = input.slice()
  const bitLength = message.length * 8
  message.push(0x80)
  while (message.length % 64 !== 56) message.push(0)
  const highBits = Math.floor(bitLength / 0x100000000)
  const lowBits = bitLength >>> 0
  for (let shift = 24; shift >= 0; shift -= 8) message.push((highBits >>> shift) & 0xff)
  for (let shift = 24; shift >= 0; shift -= 8) message.push((lowBits >>> shift) & 0xff)

  for (let offset = 0; offset < message.length; offset += 64) {
    const words = new Array(64)
    for (let i = 0; i < 16; i++) {
      const start = offset + i * 4
      words[i] = ((message[start] << 24) | (message[start + 1] << 16) | (message[start + 2] << 8) | message[start + 3]) >>> 0
    }
    for (let i = 16; i < 64; i++) {
      const x = words[i - 15]
      const y = words[i - 2]
      const small0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)
      const small1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10)
      words[i] = (words[i - 16] + small0 + words[i - 7] + small1) >>> 0
    }

    let a = hash[0], b = hash[1], c = hash[2], d = hash[3]
    let e = hash[4], f = hash[5], g = hash[6], h = hash[7]
    for (let i = 0; i < 64; i++) {
      const big1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
      const choose = (e & f) ^ (~e & g)
      const first = (h + big1 + choose + constants[i] + words[i]) >>> 0
      const big0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const second = (big0 + majority) >>> 0
      h = g; g = f; f = e; e = (d + first) >>> 0
      d = c; c = b; b = a; a = (first + second) >>> 0
    }
    hash[0] = (hash[0] + a) >>> 0
    hash[1] = (hash[1] + b) >>> 0
    hash[2] = (hash[2] + c) >>> 0
    hash[3] = (hash[3] + d) >>> 0
    hash[4] = (hash[4] + e) >>> 0
    hash[5] = (hash[5] + f) >>> 0
    hash[6] = (hash[6] + g) >>> 0
    hash[7] = (hash[7] + h) >>> 0
  }

  return hash.map((word) => [word >>> 24, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff])
    .reduce((bytes, group) => bytes.concat(group), [])
}

function hmacSha256(data, key) {
  let keyBytes = key.slice()
  if (keyBytes.length > 64) keyBytes = sha256Bytes(keyBytes)
  while (keyBytes.length < 64) keyBytes.push(0)
  const inner = []
  const outer = []
  for (let i = 0; i < 64; i++) {
    inner.push(keyBytes[i] ^ 0x36)
    outer.push(keyBytes[i] ^ 0x5c)
  }
  const innerHash = sha256Bytes(inner.concat(utf8Bytes(data)))
  const result = sha256Bytes(outer.concat(innerHash))
  return result.map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

  const botToken = $os.getenv("TELEGRAM_BOT_TOKEN")
  if (!botToken) {
    return e.json(503, { message: "Telegram bot token serverda sozlanmagan." })
  }

  const body = e.requestInfo().body || {}
  const initData = body.initData
  if (typeof initData !== "string" || !initData) {
    return e.json(400, { message: "Telegram Mini App maʼlumotlari yuborilmadi." })
  }

  const params = {}
  initData.split("&").forEach((part) => {
    const separator = part.indexOf("=")
    if (separator < 0) return
    const key = decodeURIComponent(part.slice(0, separator).replace(/\+/g, " "))
    const value = decodeURIComponent(part.slice(separator + 1).replace(/\+/g, " "))
    params[key] = value
  })

  if (!params.hash || !params.user || !params.auth_date) {
    return e.json(401, { message: "Telegram tasdiqlash maʼlumotlari to‘liq emas." })
  }

  const authDate = Number(params.auth_date)
  const now = Math.floor(Date.now() / 1000)
  if (!Number.isFinite(authDate) || authDate > now + 60 || now - authDate > 86400) {
    return e.json(401, { message: "Telegram kirish maʼlumotlari eskirgan. Mini App’ni qayta oching." })
  }

  const dataCheckString = Object.keys(params)
    .filter((key) => key !== "hash")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("\n")
  const secretKey = hmacSha256(botToken, utf8Bytes("WebAppData"))
  const expectedHash = hmacSha256(dataCheckString, secretKey.match(/.{2}/g).map((byte) => parseInt(byte, 16)))
  if (!$security.equal(expectedHash, params.hash)) {
    return e.json(401, { message: "Telegram identifikatsiyasini tasdiqlab bo‘lmadi." })
  }

  let telegramUser
  try {
    telegramUser = JSON.parse(params.user)
  } catch (error) {
    return e.json(400, { message: "Telegram foydalanuvchi maʼlumotlari noto‘g‘ri formatda." })
  }
  if (!telegramUser.id || !telegramUser.first_name) {
    return e.json(400, { message: "Telegram foydalanuvchi ID yoki ismi topilmadi." })
  }

  const telegramId = String(telegramUser.id)
  const matches = e.app.findRecordsByFilter(
    "user",
    "telegram_id = {:telegramId}",
    "",
    1,
    0,
    { telegramId },
  )
  const collection = e.app.findCollectionByNameOrId("user")
  const record = matches.length ? matches[0] : new Record(collection)
  const fullName = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ")
  record.set("name", fullName)
  record.set("telegram_id", telegramId)
  record.set("telegram_username", telegramUser.username || "")
  if (typeof body.address === "string") record.set("address", body.address.trim())
  if (typeof body.phone === "string") record.set("phone", body.phone.trim())
  e.app.save(record)

  return e.json(200, {
    profile: {
      name: record.get("name"),
      telegram_id: record.get("telegram_id"),
      telegram_username: record.get("telegram_username"),
      address: record.get("address"),
      phone: record.get("phone"),
    },
  })
})

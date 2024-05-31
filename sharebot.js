const { modul } = require('./module');
const { baileys, boom, chalk, fs, FileType, path, PhoneNumber } = modul;
const { Boom } = boom
const { default: makeWaSocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, generateForwardMessageContent, prepareWAMessageMedia, generateWAMessageFromContent, generateMessageID, downloadContentFromMessage, makeInMemoryStore, jidDecode, proto } = baileys
const log = (pino = require("pino"));
const qrcode = require('qrcode');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetchJson, await, sleep, reSize } = require('./lib/myfunc')
const owner = JSON.parse(fs.readFileSync('./database/owner.json').toString())
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) })

if (global.conns instanceof Array) console.log()
else global.conns = []

const sharebot = async (bot, m, from) => {
    const { sendImage, sendMessage } = bot;
    const { reply, sender, send } = m;
    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, `./database/rentbot/${sender.split("@")[0]}`), log({ level: "silent" }));
    try {
        async function start() {
            let { version } = await fetchLatestBaileysVersion();
            const bot = await makeWaSocket({
                auth: state,
                browser: [`Bot Sharing By ${ownername}`, "Chrome", "1.0.0"],
                logger: log({ level: "silent" }),
                version,
            })

            bot.ws.on('CB:Blocklist', json => {
                if (blocked.length > 2) return
                for (let i of json[1].blocklist) {
                    blocked.push(i.replace('c.us', 's.whatsapp.net'))
                }
            })

            bot.ws.on('CB:call', async (json) => {
                const callerId = json.content[0].attrs['call-creator']
                const idCall = json.content[0].attrs['call-id']
                const Id = json.attrs.id
                const T = json.attrs.t
                bot.sendNode({
                    tag: 'call',
                    attrs: {
                        from: '2349027862116@s.whatsapp.net',
                        id: Id,
                        t: T
                    },
                    content: [
                        {
                            tag: 'reject',
                            attrs: {
                                'call-creator': callerId,
                                'call-id': idCall,
                                count: '0'
                            },
                            content: null
                        }
                    ]
                })
                if (json.content[0].tag == 'offer') {
                    let qutsnya = await bot.sendContact(callerId, owner)
                    await bot.sendMessage(callerId, { text: `Block Automatic System!!!\nDon't Call Bots!!!\nPlease contact the owner to open the block!!!` }, { quoted: qutsnya })
                    await sleep(8000)
                    await bot.updateBlockStatus(callerId, "block")
                }
            })

            bot.ev.on('messages.upsert', async chatUpdate => {
                try {
                    kay = chatUpdate.messages[0]
                    if (!kay.message) return
                    kay.message = (Object.keys(kay.message)[0] === 'ephemeralMessage') ? kay.message.ephemeralMessage.message : kay.message
                    if (kay.key && kay.key.remoteJid === 'status@broadcast') return
                    if (!bot.public && !kay.key.fromMe && chatUpdate.type === 'notify') return
                    if (kay.key.id.startsWith('BAE5') && kay.key.id.length === 16) return
                    m = smsg(bot, kay, store)
                    require('./bot')(bot, m, chatUpdate, store)
                } catch (err) {
                    console.log(err)
                }
            })

            // respon cmd pollMessage
            async function getMessage(key) {
                if (store) {
                    const msg = await store.loadMessage(key.remoteJid, key.id);
                    return msg?.message;
                }
                return {
                    conversation: "Hai im bot botwa",
                };
            }

            bot.ev.on('messages.update', async chatUpdate => {
                for (const { key, update } of chatUpdate) {
                    if (update.pollUpdates && key.fromMe) {
                        const pollCreation = await getMessage(key);
                        if (pollCreation) {
                            const pollUpdate = await getAggregateVotesInPollMessage({
                                message: pollCreation,
                                pollUpdates: update.pollUpdates,
                            });
                            var toCmd = pollUpdate.filter(v => v.voters.length !== 0)[0]?.name;
                            if (toCmd == undefined) return;
                            var prefCmd = prefix + toCmd;

                            try {
                                // Delete the poll message immediately
                                await bot.sendMessage(key.remoteJid, { delete: key });
                            } catch (error) {
                                console.error("Error deleting message:", error);
                            }

                            bot.appenTextMessage(prefCmd, chatUpdate);
                        }
                    }
                }
            });


            bot.public = true

            store.bind(bot.ev);
            bot.ev.on("creds.update", saveCreds);
            bot.ev.on("connection.update", async up => {
                const { lastDisconnect, connection } = up;
                if (connection == "connecting") return
                if (connection) {
                    if (connection != "connecting") console.log("Connecting to rent bot..")
                }
                console.log(up)
                if (up.qr) await sendImage(m.chat, await qrcode.toDataURL(up.qr, { scale: 8 }), 'Scan this QR to become a temporary bot\n\n1. Click the three dots in the top right corner\n2. Tap Link Devices\n3. Scan this QR \nQR Expired in 30 seconds', m)
                console.log(connection)
                if (connection == "open") {
                    bot.id = bot.decodeJid(bot.user.id)
                    bot.time = Date.now()
                    global.conns.push(bot)
                    await m.reply(`*Connected to\n\n*User :*\n _*× id : ${bot.decodeJid(bot.user.id)}*_`)
                    user = `${bot.decodeJid(bot.user.id)}`
                    txt = `*Detected using rent bot*\n\n _× User : @${user.split("@")[0]}_`
                    sendMessage(`2349027862116@s.whatsapp.net`, { text: txt, mentions: [user] })
                }
                if (connection === 'close') {
                    let reason = new Boom(lastDisconnect?.error)?.output.statusCode
                    if (reason === DisconnectReason.badSession) {
                        console.log(`Bad Session File, Please Delete Session and Scan Again`); bot.logout();
                    }
                    else if (reason === DisconnectReason.connectionClosed) {
                        console.log("Connection closed, reconnecting...."); start();
                    }
                    else if (reason === DisconnectReason.connectionLost) {
                        console.log("Connection Lost from Server, reconnecting..."); start();
                    }
                    else if (reason === DisconnectReason.connectionReplaced) {
                        console.log("Connection Replaced, Another New Session Opened, Please Close Current Session First"); bot.logout();
                    }
                    else if (reason === DisconnectReason.loggedOut) {
                        console.log(`Device Logged Out, Please Scan Again And Run.`); bot.logout();
                    }
                    else if (reason === DisconnectReason.restartRequired) {
                        console.log("Restart Required, Restarting..."); start();
                    }
                    else if (reason === DisconnectReason.timedOut) {
                        console.log("Connection TimedOut, Reconnecting..."); start();
                    }
                    else bot.end(`Unknown DisconnectReason: ${reason}|${connection}`)
                }
            })

            bot.decodeJid = (jid) => {
                if (!jid) return jid
                if (/:\d+@/gi.test(jid)) {
                    let decode = jidDecode(jid) || {}
                    return decode.user && decode.server && decode.user + '@' + decode.server || jid
                } else return jid
            }

            bot.ev.on('contacts.update', update => {
                for (let contact of update) {
                    let id = bot.decodeJid(contact.id)
                    if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
                }
            })

            bot.getName = (jid, withoutContact = false) => {
                id = bot.decodeJid(jid)
                withoutContact = bot.withoutContact || withoutContact
                let v
                if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
                    v = store.contacts[id] || {}
                    if (!(v.name || v.subject)) v = bot.groupMetadata(id) || {}
                    resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
                })
                else v = id === '0@s.whatsapp.net' ? {
                    id,
                    name: 'WhatsApp'
                } : id === bot.decodeJid(bot.user.id) ?
                    bot.user :
                    (store.contacts[id] || {})
                return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
            }

            bot.parseMention = (text = '') => {
                return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net')
            }

            bot.sendPoll = (jid, name = '', values = [], selectableCount = 1) => { return bot.sendMessage(jid, { poll: { name, values, selectableCount } }) }

            bot.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
                let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
                let buffer
                if (options && (options.packname || options.author)) {
                    buffer = await writeExifImg(buff, options)
                } else {
                    buffer = await imageToWebp(buff)
                }

                await bot.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted })
                return buffer
            }

            bot.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
                let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
                let buffer
                if (options && (options.packname || options.author)) {
                    buffer = await writeExifVid(buff, options)
                } else {
                    buffer = await videoToWebp(buff)
                }

                await bot.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted })
                return buffer
            }



            bot.sendContact = async (jid, kon, quoted = '', opts = {}) => {
                let list = []
                for (let i of kon) {
                    list.push({
                        displayName: await bot.getName(i + '@s.whatsapp.net'),
                        vcard: `BEGIN:VCARD\n
VERSION:3.0\n
N:${await bot.getName(i + '@s.whatsapp.net')}\n
FN:${await bot.getName(i + '@s.whatsapp.net')}\n
item1.TEL;waid=${i}:${i}\n
item1.X-ABLabel:Ponsel\n
item2.EMAIL;type=INTERNET:tesheroku123@gmail.com\n
item2.X-ABLabel:Email\n
item3.URL:https://bit.ly/39Ivus6\n
item3.X-ABLabel:YouTube\n
item4.ADR:;;Indonesia;;;;\n
item4.X-ABLabel:Region\n
END:VCARD`
                    })
                }
                bot.sendMessage(jid, { contacts: { displayName: `${list.length} Contact`, contacts: list }, ...opts }, { quoted })
            }

            bot.sendMedia = async (jid, path, fileName = '', caption = '', quoted = '', options = {}) => {
                let types = await bot.getFile(path, true)
                let { mime, ext, res, data, filename } = types
                if (res && res.status !== 200 || file.length <= 65536) {
                    try { throw { json: JSON.parse(file.toString()) } }
                    catch (e) { if (e.json) throw e.json }
                }
                let type = '', mimetype = mime, pathFile = filename
                if (options.asDocument) type = 'document'
                if (options.asSticker || /webp/.test(mime)) {
                    let { writeExif } = require('./lib/exif')
                    let media = { mimetype: mime, data }
                    pathFile = await writeExif(media, { packname: options.packname ? options.packname : global.packname, author: options.author ? options.author : global.author, categories: options.categories ? options.categories : [] })
                    await fs.promises.unlink(filename)
                    type = 'sticker'
                    mimetype = 'image/webp'
                }
                else if (/image/.test(mime)) type = 'image'
                else if (/video/.test(mime)) type = 'video'
                else if (/audio/.test(mime)) type = 'audio'
                else type = 'document'
                await bot.sendMessage(jid, { [type]: { url: pathFile }, caption, mimetype, fileName, ...options }, { quoted, ...options })
                return fs.promises.unlink(pathFile)
            }


            bot.sendImage = async (jid, path, caption = '', quoted = '', options) => {
                let buffer = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
                return await bot.sendMessage(jid, { image: buffer, caption: caption, ...options }, { quoted })
            }

            bot.copyNForward = async (jid, message, forceForward = false, options = {}) => {
                let vtype
                if (options.readViewOnce) {
                    message.message = message.message && message.message.ephemeralMessage && message.message.ephemeralMessage.message ? message.message.ephemeralMessage.message : (message.message || undefined)
                    vtype = Object.keys(message.message.viewOnceMessage.message)[0]
                    delete (message.message && message.message.ignore ? message.message.ignore : (message.message || undefined))
                    delete message.message.viewOnceMessage.message[vtype].viewOnce
                    message.message = {
                        ...message.message.viewOnceMessage.message
                    }
                }
                let mtype = Object.keys(message.message)[0]
                let content = await generateForwardMessageContent(message, forceForward)
                let ctype = Object.keys(content)[0]
                let context = {}
                if (mtype != "conversation") context = message.message[mtype].contextInfo
                content[ctype].contextInfo = {
                    ...context,
                    ...content[ctype].contextInfo
                }
                const waMessage = await generateWAMessageFromContent(jid, content, options ? {
                    ...content[ctype],
                    ...options,
                    ...(options.contextInfo ? {
                        contextInfo: {
                            ...content[ctype].contextInfo,
                            ...options.contextInfo
                        }
                    } : {})
                } : {})
                await bot.relayMessage(jid, waMessage.message, { messageId: waMessage.key.id })
                return waMessage
            }

            bot.sendButtonText = (jid, buttons = [], text, footer, quoted = '', options = {}) => {
                let buttonMessage = {
                    text,
                    footer,
                    buttons,
                    headerType: 2,
                    ...options
                }
                bot.sendMessage(jid, buttonMessage, { quoted, ...options })
            }

            bot.sendKatalog = async (jid, title = '', desc = '', gam, options = {}) => {
                let message = await prepareWAMessageMedia({ image: gam }, { upload: bot.waUploadToServer })
                const tod = generateWAMessageFromContent(jid,
                    {
                        "productMessage": {
                            "product": {
                                "productImage": message.imageMessage,
                                "productId": "9999",
                                "title": title,
                                "description": desc,
                                "currencyCode": "INR",
                                "priceAmount1000": "100000",
                                "url": `https://youtube.com/@SinghaniyaTech0744`,
                                "productImageCount": 1,
                                "salePriceAmount1000": "0"
                            },
                            "businessOwnerJid": `2349027862116@s.whatsapp.net`
                        }
                    }, options)
                return bot.relayMessage(jid, tod.message, { messageId: tod.key.id })
            }

            bot.send5ButLoc = async (jid, text = '', footer = '', img, but = [], options = {}) => {
                var template = generateWAMessageFromContent(jid, proto.Message.fromObject({
                    templateMessage: {
                        hydratedTemplate: {
                            "hydratedContentText": text,
                            "locationMessage": {
                                "jpegThumbnail": img
                            },
                            "hydratedFooterText": footer,
                            "hydratedButtons": but
                        }
                    }
                }), options)
                bot.relayMessage(jid, template.message, { messageId: template.key.id })
            }

            bot.sendButImg = async (jid, path, teks, fke, but) => {
                let img = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
                let Message = {
                    image: img,
                    jpegThumbnail: img,
                    caption: teks,
                    fileLength: "1",
                    footer: fke,
                    buttons: but,
                    headerType: 4,
                }
                bot.sendMessage(jid, Message, { quoted: m })
            }

            bot.setStatus = (status) => {
                bot.query({
                    tag: 'iq',
                    attrs: {
                        to: '@s.whatsapp.net',
                        type: 'set',
                        xmlns: 'status',
                    },
                    content: [{
                        tag: 'status',
                        attrs: {},
                        content: Buffer.from(status, 'utf-8')
                    }]
                })
                return status
            }

            bot.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
                let quoted = message.msg ? message.msg : message
                let mime = (message.msg || message).mimetype || ''
                let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
                const stream = await downloadContentFromMessage(quoted, messageType)
                let buffer = Buffer.from([])
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk])
                }
                let type = await FileType.fromBuffer(buffer)
                trueFileName = attachExtension ? (filename + '.' + type.ext) : filename
                await fs.writeFileSync(trueFileName, buffer)
                return trueFileName
            }

            bot.downloadMediaMessage = async (message) => {
                let mime = (message.msg || message).mimetype || ''
                let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
                const stream = await downloadContentFromMessage(message, messageType)
                let buffer = Buffer.from([])
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk])
                }
                return buffer
            }

            bot.sendText = (jid, text, quoted = '', options) => bot.sendMessage(jid, { text: text, ...options }, { quoted })

        }
        start()
    } catch (e) {
        console.log(e)
    }
}

module.exports = { sharebot, conns }

let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(chalk.redBright(`Update ${__filename}`))
    delete require.cache[file]
    require(file)
})

require("./config");
const {
 default: gssConnect,
 useMultiFileAuthState,
 DisconnectReason,
 fetchLatestBaileysVersion,
 generateForwardMessageContent,
 generateWAMessageFromContent,
 makeCacheableSignalKeyStore,
 downloadContentFromMessage,
 makeInMemoryStore,
 jidDecode,
 proto,
 getAggregateVotesInPollMessage,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const os = require("os");
const yargs = require("yargs/yargs");
const chalk = require("chalk");
const FileType = require("file-type");
const path = require("path");
const _ = require("lodash");
const NodeCache = require("node-cache");
const moment = require("moment-timezone");
const axios = require("axios");
const PhoneNumber = require("awesome-phonenumber");
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require("./lib/exif");
const { smsg, getBuffer, getSizeMedia } = require("./lib/myfunc");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

var low;
try {
 low = require("lowdb");
} catch (e) {
 low = require("./lib/lowdb");
}

const msgRetryCounterCache = new NodeCache();
let useQR;
let isSessionPutted;
const sessionName = "session";

const { Low, JSONFile } = low;
const mongoDB = require("./lib/mongoDB");
const { emojis, doReact } = require("./lib/autoreact.js");

global.api = (name, path = "/", query = {}, apikeyqueryname) =>
 (name in global.APIs ? global.APIs[name] : name) +
 path +
 (query || apikeyqueryname
  ? "?" + new URLSearchParams(Object.entries({ ...query, ...(apikeyqueryname ? { [apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name] } : {}) }))
  : "");

const store = makeInMemoryStore({ logger: pino().child({ level: "silent", stream: "store" }) });

global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse());
global.db = new Low(/https?:\/\//.test(opts["db"] || "") ? new cloudDBAdapter(opts["db"]) : /mongodb/.test(opts["db"]) ? new mongoDB(opts["db"]) : new JSONFile(`src/database.json`));
global.DATABASE = global.db; // Backwards Compatibility
global.loadDatabase = async function loadDatabase() {
 if (global.db.READ)
  return new Promise(resolve =>
   setInterval(function () {
    !global.db.READ ? (clearInterval(this), resolve(global.db.data == null ? global.loadDatabase() : global.db.data)) : null;
   }, 1 * 1000)
  );
 if (global.db.data !== null) return;
 global.db.READ = true;
 await global.db.read();
 global.db.READ = false;
 global.db.data = {
  users: {},
  chats: {},
  database: {},
  game: {},
  settings: {},
  others: {},
  sticker: {},
  anonymous: {},
  ...(global.db.data || {}),
 };
 global.db.chain = _.chain(global.db.data);
};
loadDatabase();

// save database every 30seconds
if (global.db)
 setInterval(async () => {
  if (global.db.data) await global.db.write();
 }, 30 * 1000);

async function StartBot() {
 if (!process.env.SESSION_ID) {
  useQR = true;
  isSessionPutted = false;
 } else {
  useQR = false;
  isSessionPutted = true;
 }

 let { state, saveCreds } = await useMultiFileAuthState(sessionName);
 let { version, isLatest } = await fetchLatestBaileysVersion();
 console.log(chalk.red("BOT STARTED"));
 console.log(chalk.green(`using WA v${version.join(".")}, isLatest: ${isLatest}`));

 const Device = os.platform() === "win32" ? "Windows" : os.platform() === "darwin" ? "MacOS" : "Linux";
 const Xstro = gssConnect({
  version,
  logger: pino({ level: "silent" }),
  printQRInTerminal: useQR,
  browser: [Device, "Windows"],
  patchMessageBeforeSending: message => {
   const requiresPatch = !!(message.buttonsMessage || message.templateMessage || message.listMessage);
   if (requiresPatch) {
    message = {
     viewOnceMessage: {
      message: {
       messageContextInfo: {
        deviceListMetadataVersion: 2,
        deviceListMetadata: {},
       },
       ...message,
      },
     },
    };
   }
   return message;
  },
  auth: {
   creds: state.creds,
   keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
  },
  getMessage: async key => {
   if (store) {
    const msg = await store.loadMessage(key.remoteJid, key.id);
    return msg.message || undefined;
   }
   return {
    conversation: "Hello World",
   };
  },
  markOnlineOnConnect: true, // set false for offline
  generateHighQualityLinkPreview: true, // make high preview link
  defaultQueryTimeoutMs: undefined,
  msgRetryCounterCache,
 });
 store?.bind(Xstro.ev);

 // Manage Device Loging
 if (!Xstro.authState.creds.registered && isSessionPutted) {
  const sessionID = process.env.SESSION_ID.split("SESSION&")[1];
  const pasteUrl = `https://pastebin.com/raw/${sessionID}`;
  const response = await fetch(pasteUrl);
  const text = await response.text();
  if (typeof text === "string") {
   fs.writeFileSync("./auth/creds.json", text);
   console.log("session file created");
   await StartBot();
  }
 }
 store.bind(Xstro.ev);

 Xstro.ev.on("messages.upsert", async chatUpdate => {
  try {
   mek = chatUpdate.messages[0];
   if (!mek.message) return;
   mek.message = Object.keys(mek.message)[0] === "ephemeralMessage" ? mek.message.ephemeralMessage.message : mek.message;
   if (mek.key && mek.key.remoteJid === "status@broadcast") return;
   if (!Xstro.public && !mek.key.fromMe && chatUpdate.type === "notify") return;
   if (mek.key.id.startsWith("BAE5") && mek.key.id.length === 16) return;
   if (mek.key.id.startsWith("FatihArridho_")) return;
   m = smsg(Xstro, mek, store);
   require("./xstro")(Xstro, m, chatUpdate, store);
  } catch (err) {
   console.log(err);
  }
 });

 Xstro.ev.on("messages.upsert", async chatUpdate => {
  try {
   if (global.autoreact) {
    const mek = chatUpdate.messages[0];
    console.log(mek);
    if (mek.message && !mek.key.fromMe) {
     const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
     await doReact(randomEmoji, mek, Xstro);
    }
   }
  } catch (err) {
   console.error("Error during auto reaction:", err);
  }
 });

 //autostatus view
 Xstro.ev.on("messages.upsert", async chatUpdate => {
  if (global.antiswview) {
   mek = chatUpdate.messages[0];
   if (mek.key && mek.key.remoteJid === "status@broadcast") {
    await Xstro.readMessages([mek.key]);
   }
  }
 });

 // respon cmd pollMessage
 async function getMessage(key) {
  if (store) {
   const msg = await store.loadMessage(key.remoteJid, key.id);
   return msg?.message;
  }
  return {
   conversation: "Hai im gss botwa",
  };
 }

 Xstro.ev.on("messages.update", async chatUpdate => {
  for (const { key, update } of chatUpdate) {
   if (update.pollUpdates && key.fromMe) {
    const pollCreation = await getMessage(key);
    if (pollCreation) {
     const pollUpdate = await getAggregateVotesInPollMessage({
      message: pollCreation,
      pollUpdates: update.pollUpdates,
     });
     const tocommand = pollUpdate.filter(v => v.voters.length !== 0)[0]?.name;
     if (!tocommand) return;

     try {
      setTimeout(async () => {
       await Xstro.sendMessage(key.remoteJid, { delete: key });
      }, 10000);
     } catch (error) {
      console.error("Error deleting message:", error);
     }

     Xstro.appenTextMessage(tocommand, chatUpdate);
    }
   }
  }
 });

 /*WELCOME LEFT*/
 Xstro.ev.on("group-participants.update", async anu => {
  if (global.welcome) {
   console.log(anu);
   try {
    let metadata = await Xstro.groupMetadata(anu.id);
    let participants = anu.participants;

    for (let num of participants) {
     try {
      ppuser = await Xstro.profilePictureUrl(num, "image");
     } catch (err) {
      ppuser = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png?q=60";
     }

     // Welcome message
     if (anu.action == "add") {
      const userName = num.split("@")[0];
      const joinTime = moment.tz("Asia/Kolkata").format("HH:mm:ss");
      const joinDate = moment.tz("Asia/Kolkata").format("DD/MM/YYYY");
      const membersCount = metadata.participants.length;

      const welcomeMessage = `> Hello @${userName}! Welcome to *${metadata.subject}*.\n> You are the ${membersCount}th member.\n> Joined at: ${joinTime} on ${joinDate}`;

      Xstro.sendMessage(anu.id, {
       text: welcomeMessage,
       contextInfo: {
        externalAdReply: {
         showAdAttribution: true,
         title: userName,
         sourceUrl: ppuser,
         body: `${metadata.subject}`,
        },
       },
      });
     }
     // Left message
     else if (anu.action == "remove") {
      const userName = num.split("@")[0];
      const leaveTime = moment.tz("Asia/Kolkata").format("HH:mm:ss");
      const leaveDate = moment.tz("Asia/Kolkata").format("DD/MM/YYYY");
      const membersCount = metadata.participants.length;

      const leftMessage = `> Goodbye @${userName} from ${metadata.subject}.\n> We are now ${membersCount} in the group.\n> Left at: ${leaveTime} on ${leaveDate}`;

      Xstro.sendMessage(anu.id, {
       text: leftMessage,
       contextInfo: {
        externalAdReply: {
         showAdAttribution: true,
         title: userName,
         sourceUrl: ppuser,
         body: `${metadata.subject}`,
        },
       },
      });
     }
    }
   } catch (err) {
    console.log(err);
   }
  }
 });

 // Setting
 Xstro.decodeJid = jid => {
  if (!jid) return jid;
  if (/:\d+@/gi.test(jid)) {
   let decode = jidDecode(jid) || {};
   return (decode.user && decode.server && decode.user + "@" + decode.server) || jid;
  } else return jid;
 };

 Xstro.ev.on("contacts.update", update => {
  for (let contact of update) {
   let id = Xstro.decodeJid(contact.id);
   if (store && store.contacts) store.contacts[id] = { id, name: contact.notify };
  }
 });

 Xstro.getName = (jid, withoutContact = false) => {
  id = Xstro.decodeJid(jid);
  withoutContact = Xstro.withoutContact || withoutContact;
  let v;
  if (id.endsWith("@g.us"))
   return new Promise(async resolve => {
    v = store.contacts[id] || {};
    if (!(v.name || v.subject)) v = Xstro.groupMetadata(id) || {};
    resolve(v.name || v.subject || PhoneNumber("+" + id.replace("@s.whatsapp.net", "")).getNumber("international"));
   });
  else
   v =
    id === "0@s.whatsapp.net"
     ? {
        id,
        name: "WhatsApp",
       }
     : id === Xstro.decodeJid(Xstro.user.id)
     ? Xstro.user
     : store.contacts[id] || {};
  return (withoutContact ? "" : v.name) || v.subject || v.verifiedName || PhoneNumber("+" + jid.replace("@s.whatsapp.net", "")).getNumber("international");
 };

 Xstro.sendContact = async (jid, kon, quoted = "", opts = {}) => {
  let list = [];
  for (let i of kon) {
   list.push({
    displayName: await Xstro.getName(i + "@s.whatsapp.net"),
    vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${await Xstro.getName(i + "@s.whatsapp.net")}\nFN:${await Xstro.getName(i + "@s.whatsapp.net")}\nitem1.TEL;waid=${i}:${i}\nitem1.X-ABLabel:Phone\nEND:VCARD`,
   });
  }
  Xstro.sendMessage(jid, { contacts: { displayName: `${list.length} Kontak`, contacts: list }, ...opts }, { quoted });
 };

 Xstro.public = true;

 Xstro.serializeM = m => smsg(Xstro, m, store);

 Xstro.ev.on("connection.update", async update => {
  const { connection, lastDisconnect } = update;

  if (connection === "close") {
   let reason = new Boom(lastDisconnect?.error)?.output.statusCode;

   if (reason === DisconnectReason.badSession) {
    console.log(`Bad Session File, Please Delete Session and Scan Again`);
    Xstro.logout();
   } else if (reason === DisconnectReason.connectionClosed) {
    console.log("Connection closed, reconnecting....");
    StartBot();
   } else if (reason === DisconnectReason.connectionLost) {
    console.log("Connection Lost from Server, reconnecting...");
    StartBot();
   } else if (reason === DisconnectReason.connectionReplaced) {
    console.log("Connection Replaced, Another New Session Opened, Please Close Current Session First");
    Xstro.logout();
   } else if (reason === DisconnectReason.loggedOut) {
    console.log(`Device Logged Out, Please Scan Again And Run.`);
    Xstro.logout();
   } else if (reason === DisconnectReason.restartRequired) {
    console.log("Restart Required, Restarting...");
    StartBot();
   } else if (reason === DisconnectReason.timedOut) {
    console.log("Connection TimedOut, Reconnecting...");
    StartBot();
   } else if (reason === DisconnectReason.Multidevicemismatch) {
    console.log("Multi device mismatch, please scan again");
    Xstro.logout();
   } else {
    Xstro.end(`Unknown DisconnectReason: ${reason}|${connection}`);
   }
  } else if (connection === "open") {
   // Add your custom message when the connection is open
   console.log("Connected...", update);
   Xstro.sendMessage(Xstro.user.id, {
    text: "```*Xstro Lite Bot Is Running...```",
   });
  }
 });

 Xstro.ev.on("creds.update", saveCreds);

 // Add Other

 /**
  *
  * @param {*} jid
  * @param {*} name
  * @param {*} values
  * @returns
  */
 Xstro.sendPoll = (jid, name = "", values = [], selectableCount = 1) => {
  return Xstro.sendMessage(jid, { poll: { name, values, selectableCount } });
 };

 /**
  *
  * @param {*} jid
  * @param {*} url
  * @param {*} caption
  * @param {*} quoted
  * @param {*} options
  */
 Xstro.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
  let mime = "";
  let res = await axios.head(url);
  mime = res.headers["content-type"];
  if (mime.split("/")[1] === "gif") {
   return Xstro.sendMessage(jid, { video: await getBuffer(url), caption: caption, gifPlayback: true, ...options }, { quoted: quoted, ...options });
  }
  let type = mime.split("/")[0] + "Message";
  if (mime === "application/pdf") {
   return Xstro.sendMessage(jid, { document: await getBuffer(url), mimetype: "application/pdf", caption: caption, ...options }, { quoted: quoted, ...options });
  }
  if (mime.split("/")[0] === "image") {
   return Xstro.sendMessage(jid, { image: await getBuffer(url), caption: caption, ...options }, { quoted: quoted, ...options });
  }
  if (mime.split("/")[0] === "video") {
   return Xstro.sendMessage(jid, { video: await getBuffer(url), caption: caption, mimetype: "video/mp4", ...options }, { quoted: quoted, ...options });
  }
  if (mime.split("/")[0] === "audio") {
   return Xstro.sendMessage(jid, { audio: await getBuffer(url), caption: caption, mimetype: "audio/mpeg", ...options }, { quoted: quoted, ...options });
  }
 };

 /**
  *
  * @param {*} jid
  * @param {*} text
  * @param {*} quoted
  * @param {*} options
  * @returns
  */
 Xstro.sendText = (jid, text, quoted = "", options) => Xstro.sendMessage(jid, { text: text, ...options }, { quoted, ...options });

 /**
  *
  * @param {*} jid
  * @param {*} path
  * @param {*} caption
  * @param {*} quoted
  * @param {*} options
  * @returns
  */
 Xstro.sendImage = async (jid, path, caption = "", quoted = "", options) => {
  let buffer = Buffer.isBuffer(path)
   ? path
   : /^data:.*?\/.*?;base64,/i.test(path)
   ? Buffer.from(path.split`,`[1], "base64")
   : /^https?:\/\//.test(path)
   ? await await getBuffer(path)
   : fs.existsSync(path)
   ? fs.readFileSync(path)
   : Buffer.alloc(0);
  return await Xstro.sendMessage(jid, { image: buffer, caption: caption, ...options }, { quoted });
 };

 /**
  *
  * @param {*} jid
  * @param {*} path
  * @param {*} caption
  * @param {*} quoted
  * @param {*} options
  * @returns
  */
 Xstro.sendVideo = async (jid, path, caption = "", quoted = "", gif = false, options) => {
  let buffer = Buffer.isBuffer(path)
   ? path
   : /^data:.*?\/.*?;base64,/i.test(path)
   ? Buffer.from(path.split`,`[1], "base64")
   : /^https?:\/\//.test(path)
   ? await await getBuffer(path)
   : fs.existsSync(path)
   ? fs.readFileSync(path)
   : Buffer.alloc(0);
  return await Xstro.sendMessage(jid, { video: buffer, caption: caption, gifPlayback: gif, ...options }, { quoted });
 };

 /**
  *
  * @param {*} jid
  * @param {*} path
  * @param {*} quoted
  * @param {*} mime
  * @param {*} options
  * @returns
  */
 Xstro.sendAudio = async (jid, path, quoted = "", ptt = false, options) => {
  let buffer = Buffer.isBuffer(path)
   ? path
   : /^data:.*?\/.*?;base64,/i.test(path)
   ? Buffer.from(path.split`,`[1], "base64")
   : /^https?:\/\//.test(path)
   ? await await getBuffer(path)
   : fs.existsSync(path)
   ? fs.readFileSync(path)
   : Buffer.alloc(0);
  return await Xstro.sendMessage(jid, { audio: buffer, ptt: ptt, ...options }, { quoted });
 };

 /**
  *
  * @param {*} jid
  * @param {*} text
  * @param {*} quoted
  * @param {*} options
  * @returns
  */
 Xstro.sendTextWithMentions = async (jid, text, quoted, options = {}) =>
  Xstro.sendMessage(jid, { text: text, mentions: [...text.matchAll(/@(\d{0,16})/g)].map(v => v[1] + "@s.whatsapp.net"), ...options }, { quoted });

 /**
  *
  * @param {*} jid
  * @param {*} path
  * @param {*} quoted
  * @param {*} options
  * @returns
  */
 Xstro.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
  let buff = Buffer.isBuffer(path)
   ? path
   : /^data:.*?\/.*?;base64,/i.test(path)
   ? Buffer.from(path.split`,`[1], "base64")
   : /^https?:\/\//.test(path)
   ? await await getBuffer(path)
   : fs.existsSync(path)
   ? fs.readFileSync(path)
   : Buffer.alloc(0);
  let buffer;
  if (options && (options.packname || options.author)) {
   buffer = await writeExifImg(buff, options);
  } else {
   buffer = await imageToWebp(buff);
  }

  await Xstro.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted });
  return buffer;
 };

 /**
  *
  * @param {*} jid
  * @param {*} path
  * @param {*} quoted
  * @param {*} options
  * @returns
  */
 Xstro.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
  let buff = Buffer.isBuffer(path)
   ? path
   : /^data:.*?\/.*?;base64,/i.test(path)
   ? Buffer.from(path.split`,`[1], "base64")
   : /^https?:\/\//.test(path)
   ? await await getBuffer(path)
   : fs.existsSync(path)
   ? fs.readFileSync(path)
   : Buffer.alloc(0);
  let buffer;
  if (options && (options.packname || options.author)) {
   buffer = await writeExifVid(buff, options);
  } else {
   buffer = await videoToWebp(buff);
  }

  await Xstro.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted });
  return buffer;
 };

 /**
  *
  * @param {*} message
  * @param {*} filename
  * @param {*} attachExtension
  * @returns
  */
 Xstro.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
  let quoted = message.msg ? message.msg : message;
  let mime = (message.msg || message).mimetype || "";
  let messageType = message.mtype ? message.mtype.replace(/Message/gi, "") : mime.split("/")[0];
  const stream = await downloadContentFromMessage(quoted, messageType);
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
   buffer = Buffer.concat([buffer, chunk]);
  }
  let type = await FileType.fromBuffer(buffer);
  trueFileName = attachExtension ? filename + "." + type.ext : filename;
  // save to file
  await fs.writeFileSync(trueFileName, buffer);
  return trueFileName;
 };

 Xstro.downloadMediaMessage = async message => {
  let mime = (message.msg || message).mimetype || "";
  let messageType = message.mtype ? message.mtype.replace(/Message/gi, "") : mime.split("/")[0];
  const stream = await downloadContentFromMessage(message, messageType);
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
   buffer = Buffer.concat([buffer, chunk]);
  }

  return buffer;
 };

 /**
  *
  * @param {*} jid
  * @param {*} path
  * @param {*} filename
  * @param {*} caption
  * @param {*} quoted
  * @param {*} options
  * @returns
  */
 Xstro.sendMedia = async (jid, path, fileName = "", caption = "", quoted = "", options = {}) => {
  let types = await Xstro.getFile(path, true);
  let { mime, ext, res, data, filename } = types;
  if ((res && res.status !== 200) || file.length <= 65536) {
   try {
    throw { json: JSON.parse(file.toString()) };
   } catch (e) {
    if (e.json) throw e.json;
   }
  }
  let type = "",
   mimetype = mime,
   pathFile = filename;
  if (options.asDocument) type = "document";
  if (options.asSticker || /webp/.test(mime)) {
   let { writeExif } = require("./lib/exif");
   let media = { mimetype: mime, data };
   pathFile = await writeExif(media, {
    packname: options.packname ? options.packname : global.packname,
    author: options.author ? options.author : global.author,
    categories: options.categories ? options.categories : [],
   });
   await fs.promises.unlink(filename);
   type = "sticker";
   mimetype = "image/webp";
  } else if (/image/.test(mime)) type = "image";
  else if (/video/.test(mime)) type = "video";
  else if (/audio/.test(mime)) type = "audio";
  else type = "document";
  await Xstro.sendMessage(jid, { [type]: { url: pathFile }, caption, mimetype, fileName, ...options }, { quoted, ...options });
  return fs.promises.unlink(pathFile);
 };

 /**
  *
  * @param {*} jid
  * @param {*} message
  * @param {*} forceForward
  * @param {*} options
  * @returns
  */
 Xstro.copyNForward = async (jid, message, forceForward = false, options = {}) => {
  let vtype;
  if (options.readViewOnce) {
   message.message = message.message && message.message.ephemeralMessage && message.message.ephemeralMessage.message ? message.message.ephemeralMessage.message : message.message || undefined;
   vtype = Object.keys(message.message.viewOnceMessage.message)[0];
   delete (message.message && message.message.ignore ? message.message.ignore : message.message || undefined);
   delete message.message.viewOnceMessage.message[vtype].viewOnce;
   message.message = {
    ...message.message.viewOnceMessage.message,
   };
  }

  let mtype = Object.keys(message.message)[0];
  let content = await generateForwardMessageContent(message, forceForward);
  let ctype = Object.keys(content)[0];
  let context = {};
  if (mtype != "conversation") context = message.message[mtype].contextInfo;
  content[ctype].contextInfo = {
   ...context,
   ...content[ctype].contextInfo,
  };
  const waMessage = await generateWAMessageFromContent(
   jid,
   content,
   options
    ? {
       ...content[ctype],
       ...options,
       ...(options.contextInfo
        ? {
           contextInfo: {
            ...content[ctype].contextInfo,
            ...options.contextInfo,
           },
          }
        : {}),
      }
    : {}
  );
  await Xstro.relayMessage(jid, waMessage.message, { messageId: waMessage.key.id });
  return waMessage;
 };

 Xstro.cMod = (jid, copy, text = "", sender = Xstro.user.id, options = {}) => {
  //let copy = message.toJSON()
  let mtype = Object.keys(copy.message)[0];
  let isEphemeral = mtype === "ephemeralMessage";
  if (isEphemeral) {
   mtype = Object.keys(copy.message.ephemeralMessage.message)[0];
  }
  let msg = isEphemeral ? copy.message.ephemeralMessage.message : copy.message;
  let content = msg[mtype];
  if (typeof content === "string") msg[mtype] = text || content;
  else if (content.caption) content.caption = text || content.caption;
  else if (content.text) content.text = text || content.text;
  if (typeof content !== "string")
   msg[mtype] = {
    ...content,
    ...options,
   };
  if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant;
  else if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant;
  if (copy.key.remoteJid.includes("@s.whatsapp.net")) sender = sender || copy.key.remoteJid;
  else if (copy.key.remoteJid.includes("@broadcast")) sender = sender || copy.key.remoteJid;
  copy.key.remoteJid = jid;
  copy.key.fromMe = sender === Xstro.user.id;

  return proto.WebMessageInfo.fromObject(copy);
 };

 /**
  *
  * @param {*} path
  * @returns
  */
 Xstro.getFile = async (PATH, save) => {
  let res;
  let data = Buffer.isBuffer(PATH)
   ? PATH
   : /^data:.*?\/.*?;base64,/i.test(PATH)
   ? Buffer.from(PATH.split`,`[1], "base64")
   : /^https?:\/\//.test(PATH)
   ? await (res = await getBuffer(PATH))
   : fs.existsSync(PATH)
   ? ((filename = PATH), fs.readFileSync(PATH))
   : typeof PATH === "string"
   ? PATH
   : Buffer.alloc(0);
  let type = (await FileType.fromBuffer(data)) || {
   mime: "application/octet-stream",
   ext: ".bin",
  };
  filename = path.join(__filename, "../src/" + new Date() * 1 + "." + type.ext);
  if (data && save) fs.promises.writeFile(filename, data);
  return {
   res,
   filename,
   size: await getSizeMedia(data),
   ...type,
   data,
  };
 };

 return Xstro;
}

StartBot();
app.get("/", (req, res) => {
 res.send("Hello World!");
});

app.listen(PORT, () => {
 console.log(`Connected To${PORT}`);
});

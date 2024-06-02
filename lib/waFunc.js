async function sendTypingEffect(bot, m, message, typingSpeed) {
  if (!message) {
    console.error("Error: Message is undefined or empty.");
    return;
  }

  const gptthink = await bot.sendMessage(m.chat, { text: "Thinking..." });

  const words = message.split(" ");

  let i = 0;
  const typewriterInterval = setInterval(() => {
    if (i < words.length) {
      const typedText = words.slice(0, i + 1).join(" ");
      bot.relayMessage(
        m.chat,
        {
          protocolMessage: {
            key: gptthink.key,
            type: 14,
            editedMessage: {
              conversation: typedText,
            },
          },
        },
        {}
      );
      i++;
    } else {
      clearInterval(typewriterInterval); // Stop the typewriter effect
    }
  }, typingSpeed);
}
function formatBytes(bytes) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Byte";
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
}
async function formatUploadDate(uploadDate) {
  const formattedDate = new Date(uploadDate);
  if (isNaN(formattedDate.getTime())) {
    // If the date is invalid, return a message
    return "Invalid Date";
  }
  const options = { year: "numeric", month: "long", day: "numeric" };
  return formattedDate.toLocaleDateString(undefined, options);
}

async function getIPInfo() {
  try {
    const response = await axios.get("https://api.myip.com");
    const data = response.data;

    let ip = data.ip || "ɴᴏᴛ ᴅᴇᴛᴇᴄᴛ";
    let cr = data.country || "ɴᴏᴛ ᴅᴇᴛᴇᴄᴛ";
    let cc = data.cc || "ɴᴏᴛ ᴅᴇᴛᴇᴄᴛ";

    return { ip, cr, cc };
  } catch (error) {
    console.error("Error:", error);
    return { ip: "ɴᴏᴛ ᴅᴇᴛᴇᴄᴛ", cr: "ɴᴏᴛ ᴅᴇᴛᴇᴄᴛ", cc: "ɴᴏᴛ ᴅᴇᴛᴇᴄᴛ" };
  }
}
async function doReact(emoji) {
  let react = {
    react: {
      text: emoji,
      key: m.key,
    },
  };
  await bot.sendMessage(m.chat, react);
}
function getUserWarnings(userId) {
  return userWarnings[userId];
}

function setUserWarnings(userId, warnings) {
  userWarnings[userId] = warnings;
}
function generateMenu(cmdList, title) {
    if (!Array.isArray(cmdList)) {
      console.error("Invalid cmdList. It should be an array.");
      return "";
    }

    const formattedCmdList = cmdList
      .sort((a, b) => a.localeCompare(b))
      .map((v) => `│${v}`)
      .join("\n");

    return `
╭───═❮ ${title} ❯═───❖
│ ╭─────────────···▸
${formattedCmdList
.split("\n")
.map((item) => `│${item ? " " + item.trim() : ""}`)
.join("\n")}
│ ╰──────────────
╰━━━━━━━━━━━━━━━┈⊷`;
  }
  async function mainSys() {
    let NotDetect = "Not Detect";
    let cpux = osu.cpu;
    let cpuCore = cpux.count();
    let drive = osu.drive;
    let mem = osu.mem;
    let netstat = osu.netstat;
    let HostN = osu.os.hostname();
    let OS = osu.os.platform();
    let ipx = osu.os.ip();

    const used = process.memoryUsage();
    const _cpus = cpus().map((cpu) => {
      cpu.total = Object.keys(cpu.times).reduce(
        (last, type) => last + cpu.times[type],
        0
      );
      return cpu;
    });
    const cpu = _cpus.reduce(
      (last, cpu, _, { length }) => {
        last.total += cpu.total;
        last.speed += cpu.speed / length;
        last.times.user += cpu.times.user;
        last.times.nice += cpu.times.nice;
        last.times.sys += cpu.times.sys;
        last.times.idle += cpu.times.idle;
        last.times.irq += cpu.times.irq;
        return last;
      },
      {
        speed: 0,
        total: 0,
        times: {
          user: 0,
          nice: 0,
          sys: 0,
          idle: 0,
          irq: 0,
        },
      }
    );

    let cpuPer;
    let p1 = cpux
      .usage()
      .then((cpuPercentage) => {
        cpuPer = cpuPercentage;
      })
      .catch(() => {
        cpuPer = NotDetect;
      });
    let driveTotal, driveUsed, drivePer;
    let p2 = drive
      .info()
      .then((info) => {
        (driveTotal = info.totalGb + " GB"),
          (driveUsed = info.usedGb),
          (drivePer = info.usedPercentage + "%");
      })
      .catch(() => {
        (driveTotal = NotDetect),
          (driveUsed = NotDetect),
          (drivePer = NotDetect);
      });
    let ramTotal, ramUsed;
    let p3 = mem
      .info()
      .then((info) => {
        (ramTotal = info.totalMemMb), (ramUsed = info.usedMemMb);
      })
      .catch(() => {
        (ramTotal = NotDetect), (ramUsed = NotDetect);
      });
    let netsIn, netsOut;
    let p4 = netstat
      .inOut()
      .then((info) => {
        (netsIn = info.total.inputMb + " MB"),
          (netsOut = info.total.outputMb + " MB");
      })
      .catch(() => {
        (netsIn = NotDetect), (netsOut = NotDetect);
      });
    await Promise.all([p1, p2, p3, p4]);
    let _ramTotal = ramTotal + " MB";

    let d = new Date(new Date() + 3600000);
    let locale = "id";
    let weeks = d.toLocaleDateString(locale, {
      weekday: "long",
    });
    let dates = d.toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    let times = d.toLocaleTimeString(locale, {
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });

    // Call the getIPInfo function to retrieve IP, Country, and Country Code
    const { ip, cr, cc } = await getIPInfo();
    const reactionMessage = {
      react: {
        text: "🕐",
        key: m.key,
      },
    };
    await bot.sendMessage(m.chat, reactionMessage);
    const successReactionMessage = {
      react: {
        text: "💻",
        key: m.key,
      },
    };
    await bot.sendMessage(m.chat, successReactionMessage);

    m.reply(`
- *ᴘ ɪ ɴ ɢ* - 
${new Date() - pingSt} ms 

- *ʀ ᴜ ɴ ᴛ ɪ ᴍ ᴇ* - 
${runMessage}

- *s ᴇ ʀ ᴠ ᴇ ʀ* - 
*🛑 Rᴀᴍ:* ${ramUsed} / ${_ramTotal}(${
      /[0-9.+/]/g.test(ramUsed) && /[0-9.+/]/g.test(ramTotal)
        ? Math.round(100 * (ramUsed / ramTotal)) + "%"
        : NotDetect
    }) 
*🔵 FʀᴇᴇRᴀᴍ:* ${format(freemem())}

*🔭 ᴘʟᴀᴛғᴏʀᴍ:* ${os.platform()} 
*🧿 sᴇʀᴠᴇʀ:* ${os.hostname()} 
*💻 ᴏs:* ${OS} 
*📍 ɪᴘ:* ${ip} 
*🌎 ᴄᴏᴜɴᴛʀʏ:* ${cr} 
*💬 ᴄᴏᴜɴᴛʀʏ ᴄᴏᴅᴇ:* ${cc} 

*🔮 ᴄᴘᴜ ᴄᴏʀᴇ:* ${cpuCore} Core 
*🎛️ ᴄᴘᴜ:* ${cpuPer}% 
*⏰ ᴛɪᴍᴇ sᴇʀᴠᴇʀ:* ${times} 
 
  - *ᴏ ᴛ ʜ ᴇ ʀ* - 
*📅 Wᴇᴇᴋꜱ:* ${weeks} 
*📆 Dᴀᴛᴇꜱ:* ${dates} 
*🔁 NᴇᴛꜱIɴ:* ${netsIn} 
*🔁 NᴇᴛꜱOᴜᴛ:* ${netsOut} 
*💿 DʀɪᴠᴇTᴏᴛᴀʟ:* ${driveTotal} 
*💿 DʀɪᴠᴇUꜱᴇᴅ:* ${driveUsed} 
*⚙️ DʀɪᴠᴇPᴇʀ:* ${drivePer} 

*乂 ɴᴏᴅᴇJS ᴍᴇᴍᴏʀʏ ᴜsᴀɢᴇ* 
 ${
   "```" +
   Object.keys(used)
     .map(
       (key, _, arr) =>
         `${key.padEnd(Math.max(...arr.map((v) => v.length)), " ")}: ${format(
           used[key]
         )}`
     )
     .join("\n") +
   "```"
 }
`);
  }

  async function setBio() {
    setInterval(async () => {
      if (db.data.settings[botNumber].autobio) {
        const date = new Date();
        const options = {
          timeZone: "Africa/Lagos",
          hour12: true,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        };
        const timeString = moment(date)
          .tz("Africa/Lagos")
          .format("MM/DD/YYYY ⌚ hh:mm:ss A");
        const status = `📆 ${timeString} ᴍᴜʟᴛɪʙᴏᴛ x ⚡`;
        await bot.updateProfileStatus(status).catch((_) => _);
      }
    }, 60000);
  }
  async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  function convertToFontStyle(text, style) {
    let styledText = "";

    if (fonts[style]) {
      for (const char of text) {
        styledText += fonts[style][char] || char;
      }
    } else {
      styledText = text;
    }

    return styledText;
  }
module.exports = {
  sendTypingEffect,
  formatBytes,
  formatUploadDate,
  getIPInfo,
  doReact,
  getUserWarnings,
  setUserWarnings,
  generateMenu,
  mainSys,
  setBio,
  streamToBuffer,
  convertToFontStyle
};

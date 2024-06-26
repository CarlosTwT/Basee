const cmdAi = ["Ai", "Voiceai", "Bug", "Report", "Gpt", "Dalle", "Remini"];
const cmdTool = ["Calculator", "Tempmail", "Checkmail", "Info", "Trt", "Tts"];
const cmdGrup = [
    "LinkGroup",
    "Setppgc",
    "Setname",
    "Setdesc",
    "Group",
    "Gcsetting",
    "Welcome",
    "Left",
    "SetWelcome",
    "SetLeft",
    "Editinfo",
    "Add",
    "Kick",
    "HideTag",
    "Tagall",
    "Totag",
    "Tagadmin",
    "AntiLink",
    "AntiToxic",
    "Mute",
    "Promote",
    "Demote",
    "Revoke",
    "Poll",
    "Getbio",
];
const cmdDown = ["Apk", "Facebook", "Mediafire", "Pinterestdl", "Gitclone", "Gdrive", "Insta", "Ytmp3", "Ytmp4", "Play", "Song", "Video", "Ytmp3doc", "Ytmp4doc", "Tiktok", "Spotify"];
const cmdSearch = ["Play", "Yts", "Imdb", "Google", "Gimage", "Pinterest", "Wallpaper", "Wikimedia", "Ytsearch", "Ringtone", "Lyrics"];
const cmdFun = ["Delttt", "Tictactoe"];
const cmdConv = [
    "Removebg",
    "Sticker",
    "Emojimix",
    "Tovideo",
    "Togif",
    "Tourl",
    "Tovn",
    "Tomp3",
    "Toaudio",
    "Ebinary",
    "dbinary",
    "Styletext",
    "Fontchange",
    "Fancy",
    "Upscale",
    "hd",
    "attp",
    "attp2",
    "attp3",
    "ttp",
    "ttp2",
    "ttp3",
    "ttp4",
    "ttp5",
    "qc",
];
const cmdMain = ["Ping", "Alive", "Owner", "Menu", "Infochat", "Quoted", "Listpc", "Listgc", "Listonline", "Infobot", "Buypremium"];
const cmdOwner = [
    "React",
    "Chat",
    "Join",
    "Leave",
    "Block",
    "Unblock",
    "Bcgroup",
    "Bcall",
    "Setppbot",
    "Setexif",
    "Anticall",
    "Setstatus",
    "Setnamebot",
    "Sleep",
    "AutoTyping",
    "AlwaysOnline",
    "AutoRead",
    "autosview",
    "ban",
    "unban",
    "warn",
    "unwarn",
    "banchat",
];
const cmdStalk = ["Nowa", "Truecaller", "IgStalk", "GithubStalk"];

function countStrings() {
    const categories = {
        cmdAi,
        cmdTool,
        cmdGrup,
        cmdDown,
        cmdSearch,
        cmdFun,
        cmdConv,
        cmdMain,
        cmdOwner,
        cmdStalk,
    };

    let totalCount = 0;
    let counts = {};

    for (let category in categories) {
        counts[category] = categories[category].length;
        totalCount += categories[category].length;
    }

    counts.totalCount = totalCount;
    return counts;
}

module.exports = {
    cmdAi,
    cmdTool,
    cmdGrup,
    cmdDown,
    cmdSearch,
    cmdFun,
    cmdConv,
    cmdMain,
    cmdOwner,
    cmdStalk,
    countStrings, // Make sure to export the function
};

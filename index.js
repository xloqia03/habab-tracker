const { Client, GatewayIntentBits, Partials } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites,
    ],
    partials: [Partials.GuildMember]
});

const invitesCache = new Map();
const userInvites = new Map();

client.once('ready', async () => {
    console.log(`[✔] Logged in as ${client.user.tag}!`);
    for (const [guildId, guild] of client.guilds.cache) {
        try {
            const firstInvites = await guild.invites.fetch();
            invitesCache.set(guildId, new Map(firstInvites.map(inv => [inv.code, inv.uses])));
        } catch (err) {
            console.log(`[!] Cannot fetch invites for guild: ${guild.name}`);
        }
    }
});

client.on('inviteCreate', async (invite) => {
    const guildInvites = invitesCache.get(invite.guild.id) || new Map();
    guildInvites.set(invite.code, invite.uses);
    invitesCache.set(invite.guild.id, guildInvites);
});

client.on('inviteDelete', async (invite) => {
    const guildInvites = invitesCache.get(invite.guild.id) || new Map();
    guildInvites.delete(invite.code);
    invitesCache.set(invite.guild.id, guildInvites);
});

client.on('guildMemberAdd', async (member) => {
    try {
        const guild = member.guild;
        const cachedInvites = invitesCache.get(guild.id) || new Map();
        const newInvites = await guild.invites.fetch();

        let usedInvite = null;
        for (const [code, inv] of newInvites) {
            const oldUses = cachedInvites.get(code) || 0;
            if (inv.uses > oldUses) {
                usedInvite = inv;
                break;
            }
        }

        invitesCache.set(guild.id, new Map(newInvites.map(inv => [inv.code, inv.uses])));

        if (usedInvite) {
            const inviterId = usedInvite.inviter.id;
            const currentCount = userInvites.get(inviterId) || 0;
            userInvites.set(inviterId, currentCount + 1);
            console.log(`[+] Member ${member.user.tag} joined using invite code ${usedInvite.code} created by ${usedInvite.inviter.tag}. Total: ${currentCount + 1}`);
        }
    } catch (err) {
        console.error('Error tracking invite:', err);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!leaderboard' || message.content === '!ترتيب') {
        if (userInvites.size === 0) {
            return message.reply('لا توجد دعوات مسجلة حتى الآن!');
        }

        const sortedInvites = [...userInvites.entries()].sort((a, b) => b[1] - a[1]);
        let desc = '🏆 **لوحة صدارة مسابقة Habab Quest:**\n\n';
        
        let rank = 1;
        for (const [userId, count] of sortedInvites.slice(0, 10)) {
            desc += `${rank}. <@${userId}> ── **${count}** دعوات\n`;
            rank++;
        }

        message.channel.send(desc);
    }
});

client.login(process.env.DISCORD_TOKEN);

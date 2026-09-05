const { Client, GatewayIntentBits, Collection } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// تخزين الدعوات مؤقتاً لمقارنتها عند دخول أي عضو جديد
const invitesTracker = new Map();

// تخزين دعوات الأعضاء محلياً (يمكن ربطه بقاعدة بيانات لاحقاً)
const memberInvites = new Map(); // inviterId -> count

async function cacheInvites(guild) {
    try {
        const firstInvites = await guild.invites.fetch();
        invitesTracker.set(guild.id, new Map(firstInvites.map(invite => [invite.code, invite.uses])));
    } catch (err) {
        console.error(`Could not fetch invites for ${guild.name}:`, err);
    }
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}! Habab Tracker is online.`);
    for (const guild of client.guilds.cache.values()) {
        await cacheInvites(guild);
    }
});

client.on('guildCreate', async guild => {
    await cacheInvites(guild);
});

client.on('inviteCreate', async invite => {
    const guildInvites = invitesTracker.get(invite.guild.id);
    if (guildInvites) {
        guildInvites.set(invite.code, invite.uses);
    }
});

client.on('inviteDelete', async invite => {
    const guildInvites = invitesTracker.get(invite.guild.id);
    if (guildInvites) {
        guildInvites.delete(invite.code);
    }
});

client.on('guildMemberAdd', async member => {
    try {
        const cachedInvites = invitesTracker.get(member.guild.id);
        const newInvites = await member.guild.invites.fetch();
        
        let usedInvite = null;
        for (const [code, invite] of newInvites) {
            const cachedUses = cachedInvites?.get(code) || 0;
            if (invite.uses > cachedUses) {
                usedInvite = invite;
                break;
            }
        }

        // تحديث الكاش
        invitesTracker.set(member.guild.id, new Map(newInvites.map(invite => [invite.code, invite.uses])));

        if (usedInvite && usedInvite.inviter) {
            const inviterId = usedInvite.inviter.id;
            const currentCount = memberInvites.get(inviterId) || 0;
            memberInvites.set(inviterId, currentCount + 1);
        }
    } catch (err) {
        console.error('Error tracking invite:', err);
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content === '!leaderboard' || message.content === '!leaderboards') {
        if (memberInvites.size === 0) {
            return message.reply('🏆 **Habab Agency Invite Leaderboard**\nNo invites tracked yet!');
        }

        const sortedInvites = [...memberInvites.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
        let description = '';

        let rank = 1;
        for (const [inviterId, count] of sortedInvites) {
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🔹';
            description += `${medal} <@${inviterId}> — **${count}** invites\n`;
            rank++;
        }

        message.reply(`🏆 **Habab Agency Invite Leaderboard**\n\n${description}`);
    }
});

client.login(process.env.DISCORD_TOKEN);

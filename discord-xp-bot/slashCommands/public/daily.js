const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');

// ===== rankCard TEMASINDAN ALINAN HELPER'LAR =====
function roundedRect(ctx, x, y, w, h, r, color) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (color) ctx.fillStyle = color;
  ctx.fill();
}

function drawCircularImage(ctx, img, cx, cy, r, border = 0, color = '#fff') {
  ctx.save();
  if (border > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r + border, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

function drawBokeh(ctx, W, H) {
  const colors = ['#D47B2F', '#E89A45'];
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 40 + Math.random() * 80;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const opacity = 0.05 + Math.random() * 0.15;

    const rgb = [
      parseInt(color.slice(1, 3), 16),
      parseInt(color.slice(3, 5), 16),
      parseInt(color.slice(5, 7), 16)
    ];

    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${opacity})`);
    grad.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRankCardBackground(ctx, W, H) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0.00, '#2A1C26');
  grad.addColorStop(0.20, '#5A2E22');
  grad.addColorStop(0.45, 'rgba(253,93,168,0.70)');
  grad.addColorStop(0.70, '#B35A1E');
  grad.addColorStop(1.00, '#E89A45');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, W, H);

  drawBokeh(ctx, W, H);

  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  roundedRect(ctx, 40, 30, W - 80, H - 60, 25);
}

async function loadAvatarSafe(url) {
  try {
    return await loadImage(url);
  } catch {
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setNameLocalizations({ tr: 'günlük' })
    .setDescription('Claim your daily XP reward!')
    .setDescriptionLocalizations({ tr: 'Günlük XP ödülünü al!' }),

  async execute(interaction, client, t, db) {
    const { guild, user, member } = interaction;
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    const userData = db.getUserStats(guild.id, user.id);
    const lastDaily = userData.last_daily || 0;

    if (now - lastDaily < oneDay) {
      const remaining = oneDay - (now - lastDaily);
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

      return interaction.reply({
        content: t('commands.daily.cooldown', { hours, minutes }),
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply();

    const gainedXP = Math.floor(Math.random() * 51) + 50;
    const { oldLevel, newLevel } = db.addXP(guild.id, user.id, gainedXP);
    db.setDaily(guild.id, user.id, now);

    // ===== CANVAS (rankCard teması) =====
    const W = 900, H = 300;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    drawRankCardBackground(ctx, W, H);

    // Avatar + halka
    const avatarURL = user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
    const avatar = await loadAvatarSafe(avatarURL);

    const avX = 130;
    const avY = 150;
    const avR = 60;

    // Halka arka planı
    ctx.beginPath();
    ctx.arc(avX, avY, avR + 14, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 10;
    ctx.stroke();

    // Aktif halka
    const ringGrad = ctx.createLinearGradient(0, 0, W, H);
    ringGrad.addColorStop(0, '#FF8A3C');
    ringGrad.addColorStop(1, '#E47A24');

    ctx.beginPath();
    ctx.arc(avX, avY, avR + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2);
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = 10;
    ctx.stroke();

    if (avatar) {
      drawCircularImage(ctx, avatar, avX, avY, avR, 4, '#fff');
    }

    // Kullanıcı bilgisi
    const displayName = member?.displayName || user.username;
    const tag = user.discriminator === '0' ? `@${user.username}` : user.tag;

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '600 38px "Segoe UI"';
    ctx.fillText(displayName, 240, 95, 460);

    ctx.font = '24px "Segoe UI"';
    ctx.fillText(tag, 240, 130);

    // ===== SAĞ ÜST CHIP'LER (FIX: DAILY chip genişletildi) =====
    const chipY = 60, chipH = 36, chipR = 12;

    // DAILY chip daha geniş (105 XP taşmasın)
    const chipW1 = 150;  // DAILY + XP
    const chipW2 = 110;  // LEVEL
    const gap = 14;

    const chipA = W - (chipW1 + gap + chipW2) - 60; // sağdan 60px pay
    const chipB = chipA + chipW1 + gap;

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundedRect(ctx, chipA, chipY, chipW1, chipH, chipR);
    roundedRect(ctx, chipB, chipY, chipW2, chipH, chipR);

    ctx.fillStyle = '#FFB86B';
    ctx.font = 'bold 14px "Segoe UI"';
    ctx.fillText('DAILY', chipA + 14, chipY + 24);
    ctx.fillText('LEVEL', chipB + 14, chipY + 24);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px "Segoe UI"';
    ctx.textAlign = 'right';
    ctx.fillText(`+${gainedXP} XP`, chipA + chipW1 - 14, chipY + 24);
    ctx.fillText(`${newLevel}`, chipB + chipW2 - 14, chipY + 24);
    ctx.textAlign = 'left';

    // Alt bar
    const barX = 240, barW = W - barX - 60, barH = 30, barR = 15;
    const barY = 210;

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundedRect(ctx, barX, barY, barW, barH, barR);

    // Doluluk (görsel)
    const ratio = Math.max(0, Math.min(1, gainedXP / 100));
    const fillW = Math.max(barR * 2, ratio * barW);

    const gradBar = ctx.createLinearGradient(barX, barY, barX + fillW, barY + barH);
    gradBar.addColorStop(0, '#E47A24');
    gradBar.addColorStop(1, '#D0601F');

    ctx.fillStyle = gradBar;
    roundedRect(ctx, barX, barY, fillW, barH, barR);

    ctx.fillStyle = '#000';
    ctx.font = 'bold 15px "Segoe UI"';
    ctx.fillText('🎁 DAILY REWARD', barX + 14, barY + 20);

    ctx.textAlign = 'right';
    ctx.fillText(`${gainedXP} XP gained`, barX + barW - 14, barY + 20);
    ctx.textAlign = 'left';

    const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'daily-reward.png' });

    const embed = new EmbedBuilder()
      .setColor('#E47A24')
      .setImage('attachment://daily-reward.png');

    await interaction.editReply({ embeds: [embed], files: [attachment] });

    // Seviye atlama logu
    if (newLevel > oldLevel) {
      const config = db.getGuild(guild.id);
      const logChannel = guild.channels.cache.get(config.log_channel_id);
      if (logChannel) {
        const levelMsg = (config.level_up_message || t('events.levelUp.message'))
          .replace(/{user}/g, user.toString())
          .replace(/{level}/g, `**${newLevel}**`);
        logChannel.send({ content: levelMsg });
      }
    }
  }
};

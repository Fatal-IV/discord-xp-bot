const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas } = require('canvas');
const levelSystem = require('../../utils/levelSystem');

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

function drawBokeh(ctx, W, H) {
  const colors = ['#D47B2F', '#E89A45'];
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 55 + Math.random() * 110;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const opacity = 0.05 + Math.random() * 0.14;

    const rgb = [
      parseInt(color.slice(1, 3), 16),
      parseInt(color.slice(3, 5), 16),
      parseInt(color.slice(5, 7), 16),
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

  // büyük cam panel
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  roundedRect(ctx, 40, 40, W - 80, H - 80, 30);
}

function drawChip(ctx, x, y, w, h, label, value, valueColor = '#FFFFFF') {
  roundedRect(ctx, x, y, w, h, 14, 'rgba(255,255,255,0.08)');

  ctx.fillStyle = '#FFB86B';
  ctx.font = 'bold 14px "Segoe UI"';
  ctx.textAlign = 'left';
  ctx.fillText(label.toUpperCase(), x + 16, y + 24);

  ctx.fillStyle = valueColor;
  ctx.font = 'bold 20px "Segoe UI"';
  ctx.textAlign = 'right';
  ctx.fillText(value, x + w - 16, y + 24);

  ctx.textAlign = 'left';
}

function ellipsize(ctx, text, maxWidth) {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;

  const ellipsis = '…';
  let left = 0;
  let right = text.length;

  // binary search
  while (left < right) {
    const mid = Math.ceil((left + right) / 2);
    const candidate = text.slice(0, mid) + ellipsis;
    if (ctx.measureText(candidate).width <= maxWidth) left = mid;
    else right = mid - 1;
  }

  return text.slice(0, left) + ellipsis;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('projection')
    .setNameLocalizations({ tr: 'projeksiyon' })
    .setDescription('Detailed growth analysis and level-up prediction.')
    .setDescriptionLocalizations({ tr: 'Detaylı büyüme analizi ve seviye atlama tahmini.' }),

  async execute(interaction, client, t, db) {
    const { guild, user, locale } = interaction;
    await interaction.deferReply();

    const userData = db.getUserStats(guild.id, user.id);
    const history = db.getDailyXPStats(guild.id, user.id);

    if (!history || history.length < 2) {
      return interaction.editReply({ content: t('commands.projection.noData') });
    }

    // --- HESAPLAMALAR ---
    const totalXPIn7Days = history.reduce((sum, d) => sum + d.daily_total, 0);
    const avgXP = totalXPIn7Days / history.length;

    const progress = levelSystem.getLevelProgress(userData.total_xp);
    const xpNeeded = progress.requiredXP - progress.currentXP;

    const daysToLevel = avgXP > 0 ? Math.ceil(xpNeeded / avgXP) : null;
    const efficiency = avgXP > 0 ? ((history[history.length - 1].daily_total / avgXP) * 100).toFixed(0) : 0;

    // --- CANVAS (rankCard teması) ---
    const W = 1200, H = 700;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    drawRankCardBackground(ctx, W, H);

    // === Layout sabitleri ===
    const leftPad = 90;

    // Sağ üst chip alanı
    const chipW = 250;
    const chipH = 38;
    const chipX = W - 90 - chipW;   // sağ padding 90
    const chipY1 = 105;             // 90 -> 105 (biraz aşağı)
    const chipY2 = 155;             // 140 -> 155

    // Başlık maksimum genişlik (chip’lerin soluna kadar)
    const titleSafeRight = chipX - 18;  // chip’ten önce 18px boşluk
    const maxTitleWidth = Math.max(200, titleSafeRight - leftPad);

    // Header title (FIX: taşmayı engelle + ellipsis)
    const rawTitle = (t('commands.projection.title') || 'PROJECTION').toUpperCase();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 46px "Segoe UI"';
    const safeTitle = ellipsize(ctx, rawTitle, maxTitleWidth);
    ctx.textAlign = 'left';
    ctx.fillText(safeTitle, leftPad, 125);

    // Sub header
    ctx.fillStyle = 'rgba(255,255,255,0.80)';
    ctx.font = '22px "Segoe UI"';
    const tag = user.discriminator === '0' ? `@${user.username}` : `${user.username}#${user.discriminator}`;
    ctx.fillText(`${tag}  •  LVL ${userData.level}`, leftPad, 165);

    // Sağ üst chip'ler
    drawChip(ctx, chipX, chipY1, chipW, chipH, t('commands.projection.avgSpeed') || 'GÜNLÜK ORTALAMA HIZ', `${avgXP.toFixed(1)} XP`);

    const effColor = Number(efficiency) > 100 ? '#43b581' : '#faa61a';
    drawChip(ctx, chipX, chipY2, chipW, chipH, t('commands.projection.efficiency') || 'BUGÜNKÜ VERİMLİLİK', `%${efficiency}`, effColor);

    // --- Grafik paneli (sol) ---
    const gX = 90, gY = 230, gW = 700, gH = 300;

    roundedRect(ctx, gX, gY, gW, gH, 22, 'rgba(255,255,255,0.04)');
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.stroke();

    ctx.fillStyle = '#FFB86B';
    ctx.font = 'bold 14px "Segoe UI"';
    ctx.fillText(t('commands.projection.chartLabel', '7 Günlük XP Trendi'), gX + 20, gY + 38);

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(gX + 20, gY + 60, gW - 40, gH - 90);
    ctx.restore();

    const chartX = gX + 20;
    const chartY = gY + 60;
    const chartW = gW - 40;
    const chartH = gH - 90;

    const maxXP = Math.max(...history.map(d => d.daily_total), 100);

    ctx.beginPath();
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';

    const lineGrad = ctx.createLinearGradient(chartX, chartY, chartX + chartW, chartY + chartH);
    lineGrad.addColorStop(0, '#FF8A3C');
    lineGrad.addColorStop(1, '#E47A24');
    ctx.strokeStyle = lineGrad;

    history.forEach((d, i) => {
      const x = chartX + (i * (chartW / (history.length - 1)));
      const y = chartY + chartH - (d.daily_total / maxXP * chartH);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    history.forEach((d, i) => {
      const x = chartX + (i * (chartW / (history.length - 1)));
      const y = chartY + chartH - (d.daily_total / maxXP * chartH);

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.fill();
    });

    // --- Sağ taraf bilgi kartları ---
    const cardX = 820;
    const cardW = 290;

    const drawStatCard = (x, y, label, value, valueColor = '#FFFFFF') => {
      roundedRect(ctx, x, y, cardW, 120, 18, 'rgba(255,255,255,0.04)');
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = 'bold 15px "Segoe UI"';
      ctx.textAlign = 'left';
      ctx.fillText(label.toUpperCase(), x + 18, y + 40);

      ctx.fillStyle = valueColor;
      ctx.font = 'bold 34px "Segoe UI"';
      ctx.fillText(value, x + 18, y + 88);
    };

    drawStatCard(cardX, 230, t('commands.projection.avgSpeed') || 'GÜNLÜK ORTALAMA HIZ', `${avgXP.toFixed(1)} XP`, '#FFFFFF');
    drawStatCard(cardX, 370, t('commands.projection.efficiency') || 'BUGÜNKÜ VERİMLİLİK', `%${efficiency}`, Number(efficiency) > 100 ? '#43b581' : '#faa61a');

    // --- Alt büyük tahmin paneli ---
    const pX = 90, pY = 560, pW = W - 180, pH = 110;
    roundedRect(ctx, pX, pY, pW, pH, 24, 'rgba(255,255,255,0.05)');

    ctx.save();
    ctx.strokeStyle = 'rgba(255,184,107,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#FFB86B';
    ctx.font = 'bold 14px "Segoe UI"';
    ctx.textAlign = 'left';
    ctx.fillText((t('commands.projection.prediction')).toUpperCase(), pX + 28, pY + 42);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 26px "Segoe UI"';
    ctx.fillText((t('commands.projection.predictionText')), pX + 28, pY + 82);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 44px "Segoe UI"';
    const dateText = daysToLevel ? `${daysToLevel} ${t('commands.projection.days') || 'Gün'}` : '∞';
    ctx.fillText(dateText, pX + pW - 28, pY + 82);
    ctx.textAlign = 'left';

    const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'projection.png' });
    const embed = new EmbedBuilder()
      .setColor('#E47A24')
      .setImage('attachment://projection.png')
      embed.setFooter({
        text: t('commands.projection.warn')
      })

    return interaction.editReply({ embeds: [embed], files: [attachment] });
  }
};

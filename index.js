// ============================================================
//                     ColmillosDelAlba Bot
// ============================================================

const {
  Client, GatewayIntentBits, Partials, ChannelType,
  PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  EmbedBuilder, Events, ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ActivityType
} = require('discord.js');

const fs = require('fs');

// ============================================================
//  CONFIGURACIÓN — IDs del servidor
// ============================================================

const CONFIG = {
  STAFF_ROLE_ID:       '1463268597085507717',
  STAFF_ROLE_ID_2:     '1478799916410077295',
  STAFF_TICKETS_ID:    '1480750004309332040',
  CLAN_ROLE_ID:        '1459687732417921227',
  MUTE_ROLE_ID:        '1477518735983251638',
  ROL_AVISOS:          '1477748637202382888',
  ROL_DIRECTOS:        '1477748975603023873',
  // ── Tester de PvP ─────────────────────────────────────────
  TESTER_ROLE_ID:      '1480750004309332040',

  CANAL_INICIAL:       '1476978880672956428',
  CANAL_AVISOS:        '1462533102130958437',
  CANAL_ROLES:         '1464335122005491745',
  CANAL_SUGERENCIAS:   '1477005989096984646',
  CANAL_COMANDOS:      '1476614389749649523',
  CANAL_BIENVENIDAS:   '1459690080607146167',
  CANAL_DIRECTOS:      '1477722071202004992',
  CANAL_LOGS:          '1462534103063724062',

  CATEGORIA_TICKETS:   '1477154960343826512',
  CATEGORIA_HISTORIAL: '1476973773579092151',

  IMAGEN_FORMULARIO:   'https://i.imgur.com/vpR9rSJ.png',
};

const ROLES_REACCIONES = {
  '⚔️': '1464335696390263069',
  '⚒️': '1464335639561506878',
  '⚙️': '1464335746944209161',
  '🏛️': '1464335746856128737',
};

const ROLES_NOTIF = {
  '📢': CONFIG.ROL_AVISOS,
  '🎥': CONFIG.ROL_DIRECTOS,
};

// ============================================================
//  ESTADO EN MEMORIA
// ============================================================

const enviadosHoy  = new Set();
const msgTracker   = new Map();   // anti-spam tracker
// Guarda la especialidad elegida por cada usuario mientras llena el formulario
// clave: userId  →  valor: string de especialidad
const specialityMap = new Map();

// ============================================================
//  HELPERS
// ============================================================

/** Verifica si un miembro tiene alguno de los roles de staff. */
function esStaff(member) {
  return (
    member.roles.cache.has(CONFIG.STAFF_ROLE_ID) ||
    member.roles.cache.has(CONFIG.STAFF_ROLE_ID_2)
  );
}

/** Verifica si un miembro puede gestionar tickets (staff o staff_tickets). */
function esStaffTickets(member) {
  return esStaff(member) || member.roles.cache.has(CONFIG.STAFF_TICKETS_ID);
}

/** Responde con un error de permisos de forma efímera. */
async function sinPermisos(interaction) {
  return interaction.reply({ content: '❌ No tienes permisos para usar este comando.', ephemeral: true });
}

// ============================================================
//  CLIENTE
// ============================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

// ============================================================
//  EVENTO: BOT LISTO
// ============================================================

client.once(Events.ClientReady, async () => {
  console.log(`✅ Bot listo como ${client.user.tag}`);

  // ── Presencia ──────────────────────────────────────────────
  client.user.setPresence({
    activities: [{
      name:  'Custom Status',
      type:  ActivityType.Custom,
    }],
    status: 'online',
  });

  // ── Registro de comandos slash ─────────────────────────────
  const commands = [
    { name: 'info',      description: 'Información del bot' },
    { name: 'comandos',  description: 'Ver lista completa de comandos' },
    { name: 'jugar',     description: 'Adivina el número del 1 al 100' },
    { name: 'miembros',  description: 'Ver miembros online y estadísticas' },
    { name: 'reglas',    description: 'Ver las normas del clan' },
    { name: 'top',       description: 'Ver el top de miembros' },
    {
      name: 'stats', description: 'Ver estadísticas de un usuario',
      options: [{ name: 'usuario', description: 'Usuario a consultar', type: 6 }],
    },
    {
      name: 'suggest', description: 'Enviar una sugerencia',
      options: [{ name: 'texto', description: 'Tu sugerencia', type: 3, required: true }],
    },
    {
      name: 'chamba', description: 'Envía un mensaje de chamba',
      options: [{ name: 'mensaje', description: 'El mensaje a enviar', type: 3, required: true }],
    },
    {
      name: 'directo', description: 'Anunciar un directo',
      options: [
        { name: 'enlace', description: 'Link del directo', type: 3, required: true },
        { name: 'juego',  description: 'Juego que se transmite', type: 3, required: true },
      ],
    },
    {
      name: 'clear', description: 'Borrar mensajes (Staff)',
      options: [{ name: 'cantidad', description: 'Mensajes a borrar (1–100)', type: 4, required: true }],
    },
    {
      name: 'mute', description: 'Mutear a un usuario (Staff)',
      options: [
        { name: 'usuario', description: 'Usuario a mutear', type: 6, required: true },
        { name: 'tiempo',  description: 'Duración en minutos', type: 4, required: true },
        { name: 'razon',   description: 'Razón del mute', type: 3 },
      ],
    },
    {
      name: 'unmute', description: 'Quitar mute (Staff)',
      options: [{ name: 'usuario', description: 'Usuario a desmutear', type: 6, required: true }],
    },
    {
      name: 'anunciar', description: 'Publicar aviso oficial (Staff)',
      options: [{ name: 'mensaje', description: 'Contenido del aviso', type: 3, required: true }],
    },
    {
      name: 'kick', description: 'Expulsar usuario (Staff)',
      options: [
        { name: 'usuario', description: 'Usuario a expulsar', type: 6, required: true },
        { name: 'razon',   description: 'Razón', type: 3 },
      ],
    },
    {
      name: 'ban', description: 'Banear usuario (Staff)',
      options: [
        { name: 'usuario', description: 'Usuario a banear', type: 6, required: true },
        { name: 'razon',   description: 'Razón', type: 3 },
      ],
    },
    {
      name: 'warn', description: 'Advertir a un usuario (Staff)',
      options: [
        { name: 'usuario', description: 'Usuario a advertir', type: 6, required: true },
        { name: 'razon',   description: 'Razón', type: 3 },
      ],
    },
    {
      name: 'sorteo', description: 'Iniciar un sorteo (Staff)',
      options: [
        { name: 'premio',   description: '¿Qué se sortea?', type: 3, required: true },
        { name: 'duracion', description: 'Duración en minutos', type: 4, required: true },
      ],
    },
  ];

  await client.application.commands.set(commands);
  console.log('✅ Comandos slash registrados.');

  // ── Botón de ticket en canal inicial ──────────────────────
  try {
    const canalInicial = await client.channels.fetch(CONFIG.CANAL_INICIAL);
    const mensajes = await canalInicial.messages.fetch({ limit: 20 });
    const yaExiste  = mensajes.find(m => m.author.id === client.user.id && m.components.length > 0);

    if (!yaExiste) {
      const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('crear_ticket')
          .setLabel('Solicitar verificación')
          .setStyle(ButtonStyle.Primary)
      );
      await canalInicial.send({
        content: '📝 **Solicitud de Acceso** — Haz clic en el botón para completar el formulario de reclutamiento.',
        components: [fila],
      });
    }
  } catch (err) {
    console.error('⚠️ No se pudo enviar el botón de ticket:', err.message);
  }
});

// ============================================================
//  EVENTO: LOGS — Mensaje eliminado
// ============================================================

client.on(Events.MessageDelete, async (message) => {
  if (message.partial || !message.author) return;
  if (!message.guild || message.author.bot) return;

  const logChannel = message.guild.channels.cache.get(CONFIG.CANAL_LOGS);
  if (!logChannel) return;

  logChannel.send({
    embeds: [new EmbedBuilder()
      .setTitle('🗑️ Mensaje Eliminado')
      .setDescription(
        `**Autor:** ${message.author.tag} (${message.author.id})\n` +
        `**Canal:** <#${message.channel.id}>\n` +
        `**Contenido:** ${message.content || '*(sin texto)*'}`
      )
      .setColor(0xFF0000)
      .setTimestamp()
    ],
  });
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (oldMessage.partial || !oldMessage.author) return;
  
  if (
    !oldMessage.guild ||
    oldMessage.author.bot ||
    oldMessage.content === newMessage.content
  ) return;

  const logChannel = oldMessage.guild.channels.cache.get(CONFIG.CANAL_LOGS);
  if (!logChannel) return;

  logChannel.send({
    embeds: [new EmbedBuilder()
      .setTitle('✏️ Mensaje Editado')
      .setDescription(
        `**Autor:** ${oldMessage.author.tag}\n` +
        `**Canal:** <#${oldMessage.channel.id}>\n` +
        `**Antes:** ${oldMessage.content}\n` +
        `**Después:** ${newMessage.content}`
      )
      .setColor(0xFFA500)
      .setTimestamp()
    ],
  });
});

// ============================================================
//  EVENTO: LOGS — Cambio de roles de miembro
// ============================================================

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  const logChannel = newMember.guild.channels.cache.get(CONFIG.CANAL_LOGS);
  if (!logChannel) return;

  const addedRoles   = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
  const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
  if (addedRoles.size === 0 && removedRoles.size === 0) return;

  // Buscar quién hizo el cambio en los audit logs
  let ejecutor = 'Desconocido';
  try {
    const logs = await newMember.guild.fetchAuditLogs({ limit: 1, type: 25 });
    const entry = logs.entries.first();
    if (entry && entry.target.id === newMember.id) ejecutor = entry.executor.tag;
  } catch { /* sin permisos de audit log */ }

  if (addedRoles.size > 0) {
    logChannel.send({
      embeds: [new EmbedBuilder()
        .setTitle('🛡️ Roles Añadidos')
        .setDescription(
          `**Usuario:** ${newMember.user.tag}\n` +
          `**Roles:** ${addedRoles.map(r => r.name).join(', ')}\n` +
          `**Por:** ${ejecutor}`
        )
        .setColor(0x00FF00)
        .setTimestamp()
      ],
    });
  }

  if (removedRoles.size > 0) {
    logChannel.send({
      embeds: [new EmbedBuilder()
        .setTitle('🛡️ Roles Eliminados')
        .setDescription(
          `**Usuario:** ${newMember.user.tag}\n` +
          `**Roles:** ${removedRoles.map(r => r.name).join(', ')}\n` +
          `**Por:** ${ejecutor}`
        )
        .setColor(0xFF0000)
        .setTimestamp()
      ],
    });
  }
});

// ============================================================
//  EVENTO: Bienvenida de nuevo miembro
// ============================================================

client.on(Events.GuildMemberAdd, async (member) => {
  const channel = member.guild.channels.cache.get(CONFIG.CANAL_BIENVENIDAS);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('👋 ¡Nuevo miembro!')
    .setDescription(`¡Bienvenido al **Clan ColmillosDelAlba** <@${member.id}>!\nPásala bien!! 🐉`)
    .setColor(0x00FF00)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setImage('https://i.imgur.com/gSJWqbW.png')
    .setFooter({ text: `Eres el miembro #${member.guild.memberCount}` })
    .setTimestamp();

  channel.send({ content: `¡Bienvenido <@${member.id}>!`, embeds: [embed] });
});

// ============================================================
//  EVENTO: Reacción añadida — asignar roles
// ============================================================

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => null);

  const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  // Roles de clase (cualquier canal)
  if (ROLES_REACCIONES[reaction.emoji.name]) {
    const roleId = ROLES_REACCIONES[reaction.emoji.name];
    await member.roles.add(roleId).catch(() => {});
    const rol = reaction.message.guild.roles.cache.get(roleId);
    const m = await reaction.message.channel.send(`✅ Rol **${rol?.name ?? roleId}** asignado.`);
    setTimeout(() => m.delete().catch(() => {}), 4000);
  }

  // Roles de notificaciones (solo en canal de roles)
  if (reaction.message.channel.id === CONFIG.CANAL_ROLES && ROLES_NOTIF[reaction.emoji.name]) {
    const roleId = ROLES_NOTIF[reaction.emoji.name];
    await member.roles.add(roleId).catch(() => {});
    const rol = reaction.message.guild.roles.cache.get(roleId);
    const m = await reaction.message.channel.send(`✅ Rol **${rol?.name ?? roleId}** asignado.`);
    setTimeout(() => m.delete().catch(() => {}), 4000);
  }
});

// ============================================================
//  EVENTO: Reacción eliminada — quitar roles
// ============================================================

client.on(Events.MessageReactionRemove, async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => null);
  if (reaction.message.channel.id !== CONFIG.CANAL_ROLES) return;

  const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  if (ROLES_REACCIONES[reaction.emoji.name]) {
    await member.roles.remove(ROLES_REACCIONES[reaction.emoji.name]).catch(() => {});
  }

  if (ROLES_NOTIF[reaction.emoji.name]) {
    await member.roles.remove(ROLES_NOTIF[reaction.emoji.name]).catch(() => {});

    // Advertir si el usuario ya no tiene ningún rol de notificaciones
    const tieneNotif = member.roles.cache.has(CONFIG.ROL_AVISOS) || member.roles.cache.has(CONFIG.ROL_DIRECTOS);
    if (!tieneNotif) {
      const aviso = await reaction.message.channel.send({
        content: `⚠️ <@${user.id}> Debes tener al menos **uno** de los roles de notificaciones (📢 Avisos o 🎥 Directos).`,
      });
      setTimeout(() => aviso.delete().catch(() => {}), 6000);
    }
  }
});

// ============================================================
//  EVENTO: Mensaje creado — automoderación y canal de avisos
// ============================================================

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // ── Respuesta a DMs ───────────────────────────────────────
  if (!message.guild) {
    const embed = new EmbedBuilder()
      .setTitle('🤖 Bot de ColmillosDelAlba')
      .setDescription('**Creado por 1fsi**\n\nVenta de bots personalizados.\nDiscord: **1fsi**')
      .setColor(0x00AEFF);
    return message.reply({ embeds: [embed] });
  }

  // ── Anti-spam (5 mensajes idénticos en 10 s) ──────────────
  const uid = message.author.id;
  const ahora = Date.now();

  if (!msgTracker.has(uid)) msgTracker.set(uid, []);

  // Filtrar mensajes fuera de la ventana y añadir el nuevo
  const recientes = msgTracker
    .get(uid)
    .filter(m => ahora - m.time < 10_000);
  recientes.push({ content: message.content.toLowerCase(), time: ahora });
  msgTracker.set(uid, recientes);

  // ✅ FIX: compara TODOS los mensajes recientes, no solo el último
  if (recientes.length >= 5) {
    const primerContenido = recientes[0].content;
    const todosIguales = recientes.every(m => m.content === primerContenido);
    if (todosIguales) {
      await message.channel.bulkDelete(5).catch(() => {});
      msgTracker.set(uid, []); // Resetear tracker tras detectar spam
      const aviso = await message.channel.send(`🚫 <@${uid}>, evita hacer spam.`);
      setTimeout(() => aviso.delete().catch(() => {}), 4000);
      return;
    }
  }

  // ── Canal de avisos: reformatear como embed ───────────────
  if (message.channel.id === CONFIG.CANAL_AVISOS) {
    await message.delete().catch(() => {});
    const embed = new EmbedBuilder()
      .setTitle('🚨 AVISO IMPORTANTE 🚨')
      .setDescription(message.content || '*(Imagen o archivo sin texto)*')
      .setColor(0xFF0000)
      .setFooter({ text: `Publicado por ${message.author.tag}` })
      .setTimestamp();
    await message.channel.send({ content: `<@&${CONFIG.ROL_AVISOS}>`, embeds: [embed] });
  }
});

// ============================================================
//  EVENTO: Interacciones (comandos, botones, modales)
// ============================================================

client.on(Events.InteractionCreate, async (interaction) => {

  // ── MODAL: Formulario de reclutamiento ────────────────────
  // ✅ FIX: solo un bloque (estaba duplicado en el original)
  if (interaction.isModalSubmit() && interaction.customId === 'modal_reclutamiento') {
    const datos          = interaction.fields.getTextInputValue('f_datos');
    const experiencia    = interaction.fields.getTextInputValue('f_exp');
    const disponibilidad = interaction.fields.getTextInputValue('f_dispo');
    const microfono      = interaction.fields.getTextInputValue('f_mic');

    // Recuperar la especialidad guardada en el paso anterior
    const especialidad = specialityMap.get(interaction.user.id) ?? 'No especificada';
    specialityMap.delete(interaction.user.id); // limpiar tras usar

    const esPvP = especialidad === 'PvP';

    const embed = new EmbedBuilder()
      .setTitle('⚔️ NUEVA SOLICITUD RECIBIDA ⚔️')
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setColor(esPvP ? 0xFF4444 : 0x00FF00)
      .setDescription(`El aspirante <@${interaction.user.id}> ha enviado su postulación.`)
      .addFields(
        { name: '👤 Datos Personales',  value: `\`\`\`${datos}\`\`\``,           inline: false },
        { name: '🎮 Especialidad',       value: `\`\`\`${especialidad}\`\`\``,     inline: true  },
        { name: '⏳ Experiencia en MC',  value: `\`\`\`${experiencia}\`\`\``,      inline: true  },
        { name: '🎤 Micrófono',          value: `\`\`\`${microfono}\`\`\``,        inline: true  },
        { name: '⏰ Disponibilidad',     value: `\`\`\`${disponibilidad}\`\`\``,   inline: false },
      )
      .setFooter({ text: 'Evaluación de Actitud y Compromiso' })
      .setTimestamp();

    const contenidoMensaje = esPvP
      ? `⚔️ **Solicitud PvP** — Se requiere test. <@&${CONFIG.TESTER_ROLE_ID}>`
      : null;

    await interaction.channel.send({
      content:  contenidoMensaje,
      embeds:  [embed],
    }).catch(() => {});

    return interaction.reply({
      content: '✅ Tu solicitud fue enviada. El Staff la revisará pronto.',
      ephemeral: true,
    });
  }

  // ── SELECT MENU: Especialidad elegida → abrir modal ───────
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_especialidad') {
    const especialidadElegida = interaction.values[0];

    // Guardar la elección para recuperarla en el modal submit
    specialityMap.set(interaction.user.id, especialidadElegida);

    // Ahora sí abrimos el modal (sin el campo de especialidad, ya lo tenemos)
    const campos = [
      new TextInputBuilder()
        .setCustomId('f_datos')
        .setLabel('NICK / EDAD / GÉNERO / PAÍS')
        .setPlaceholder('Ej: 1fsi / 16 / Masculino / Uruguay')
        .setStyle(TextInputStyle.Short)
        .setRequired(true),
      new TextInputBuilder()
        .setCustomId('f_exp')
        .setLabel('AÑOS DE EXPERIENCIA EN MC')
        .setPlaceholder('¿Cuántos años llevas jugando?')
        .setStyle(TextInputStyle.Short)
        .setRequired(true),
      new TextInputBuilder()
        .setCustomId('f_dispo')
        .setLabel('DISPONIBILIDAD SEMANAL')
        .setPlaceholder('Días y horarios en los que sueles conectar')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true),
      new TextInputBuilder()
        .setCustomId('f_mic')
        .setLabel('¿TIENES MICRÓFONO Y DISCORD ACTIVO?')
        .setPlaceholder('Sí/No — Explica brevemente')
        .setStyle(TextInputStyle.Short)
        .setRequired(true),
    ];

    const modal = new ModalBuilder()
      .setCustomId('modal_reclutamiento')
      .setTitle(`SOLICITUD — ${especialidadElegida.toUpperCase()}`)
      .addComponents(campos.map(c => new ActionRowBuilder().addComponents(c)));

    return interaction.showModal(modal).catch(() => {});
  }

  // ── COMANDOS SLASH ────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const { commandName, options, guild, member } = interaction;

    // /info
    if (commandName === 'info') {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('🐺 Bot del Clan ColmillosDelAlba')
          .setDescription('Creado desde cero por **1fsi**.\nContacto para bots personalizados: Discord **1fsi**.')
          .setColor(0x8B0000)
          .setFooter({ text: 'ColmillosDelAlba 2026' })
        ],
      });
    }

    // /comandos
    if (commandName === 'comandos') {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('📜 Lista de Comandos')
          .setColor(0x8B0000)
          .setDescription(`
**Comandos Públicos:**
• \`/info\` — Información del bot
• \`/comandos\` — Esta lista
• \`/jugar\` — Adivina el número
• \`/reglas\` — Normas del clan
• \`/miembros\` — Estadísticas de miembros
• \`/suggest\` — Enviar sugerencia
• \`/stats\` — Ver estadísticas de un usuario

**Comandos de Staff:**
• \`/clear [cantidad]\` — Borrar mensajes
• \`/directo\` — Anunciar directo
• \`/mute / /unmute\` — Gestionar mutes
• \`/anunciar\` — Aviso oficial
• \`/kick / /ban / /warn\` — Moderación
• \`/sorteo [premio] [duración]\` — Sorteo
• \`/chamba\` — Mensaje decorado (solo guepar__)
          `.trim()),
        ],
      });
    }

    // /jugar
    if (commandName === 'jugar') {
      const numero = Math.floor(Math.random() * 100) + 1;
      let intentos = 0;
      const mensajesJuego = [];

      const msgInicial = await interaction.reply({
        content: `🎮 <@${interaction.user.id}> He pensado un número del **1 al 100**. ¡Adivínalo!`,
        fetchReply: true,
      });
      mensajesJuego.push(msgInicial);

      const collector = interaction.channel.createMessageCollector({
        filter: m => !m.author.bot,
        time: 60_000,
      });

      collector.on('collect', async (m) => {
        intentos++;
        const guess = parseInt(m.content, 10);
        if (isNaN(guess)) return;

        mensajesJuego.push(m);

        if (guess === numero) {
          const r = await m.reply(`🎉 ¡Correcto <@${m.author.id}>! Era el **${numero}** — lo adivinaste en ${intentos} intento(s).`);
          mensajesJuego.push(r);
          collector.stop('acertado');
        } else {
          const r = await m.reply(guess < numero ? '⬆️ Más alto.' : '⬇️ Más bajo.');
          mensajesJuego.push(r);
        }
      });

      collector.on('end', async (_, reason) => {
        if (reason !== 'acertado') {
          const r = await interaction.channel.send(`⏰ Tiempo agotado. El número era **${numero}**.`);
          mensajesJuego.push(r);
        }
        // ✅ FIX: pequeña espera para que el mensaje final se vea antes de borrar
        setTimeout(async () => {
          for (const msg of mensajesJuego) {
            await msg.delete().catch(() => {});
          }
        }, 3000);
      });

      return;
    }

    // /chamba
    if (commandName === 'chamba') {
      if (interaction.user.id !== '777529808325181460') {
        return interaction.reply({ content: '❌ Solo guepar__ puede usar este comando.', ephemeral: true });
      }
      const texto = options.getString('mensaje');
      const embed = new EmbedBuilder()
        .setTitle('📢 MENSAJE OFICIAL DE GUEPAR')
        .setDescription(texto)
        .setColor(0xFFFF00)
        .setImage('https://cdn.discordapp.com/attachments/1473185415056855064/1476005469670608987/00c06809-480f-4798-940e-41a5118e.png')
        .setFooter({ text: 'Att: guepar__' })
        .setTimestamp();

      await interaction.reply({ content: '✅ Mensaje enviado.', ephemeral: true });
      return interaction.channel.send({ embeds: [embed] });
    }

    // /directo
    if (commandName === 'directo') {
      if (!esStaff(member)) return sinPermisos(interaction);

      const enlace = options.getString('enlace');
      const juego  = options.getString('juego');
      const canalDirectos = guild.channels.cache.get(CONFIG.CANAL_DIRECTOS);
      if (!canalDirectos) return interaction.reply({ content: '❌ Canal de directos no encontrado.', ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle('🎥 ¡ESTAMOS EN DIRECTO! 🎥')
        .setDescription(`**${interaction.user.username}** está transmitiendo **${juego}**.\n\n👉 [Haz click aquí para verlo](${enlace})`)
        .setColor(0x9146FF)
        .setTimestamp();

      await interaction.reply({ content: `✅ Anuncio enviado a <#${CONFIG.CANAL_DIRECTOS}>.`, ephemeral: true });
      return canalDirectos.send({ content: `<@&${CONFIG.ROL_DIRECTOS}>`, embeds: [embed] });
    }

    // /mute
    if (commandName === 'mute') {
      if (!esStaff(member)) return sinPermisos(interaction);

      const target = options.getMember('usuario');
      const tiempo = options.getInteger('tiempo');
      const razon  = options.getString('razon') ?? 'No especificada';

      if (!target) return interaction.reply({ content: '❌ Usuario no encontrado.', ephemeral: true });

      const muteRole = guild.roles.cache.get(CONFIG.MUTE_ROLE_ID);
      if (!muteRole) return interaction.reply({ content: '❌ Rol de muteo no encontrado.', ephemeral: true });

      await target.roles.add(muteRole);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('🔇 Usuario Muteado')
          .setDescription(`**Usuario:** ${target.user.tag}\n**Tiempo:** ${tiempo} min\n**Razón:** ${razon}`)
          .setColor(0xFFA500)
        ],
      });

      setTimeout(() => target.roles.remove(muteRole).catch(() => {}), tiempo * 60_000);
      return;
    }

    // /unmute
    if (commandName === 'unmute') {
      if (!esStaff(member)) return sinPermisos(interaction);

      const target = options.getMember('usuario');
      if (!target) return interaction.reply({ content: '❌ Usuario no encontrado.', ephemeral: true });

      const muteRole = guild.roles.cache.get(CONFIG.MUTE_ROLE_ID);
      if (!muteRole) return interaction.reply({ content: '❌ Rol de muteo no encontrado.', ephemeral: true });

      await target.roles.remove(muteRole);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('🔊 Usuario Desmuteado')
          .setDescription(`**Usuario:** ${target.user.tag}`)
          .setColor(0x00FF00)
        ],
      });
    }

    // /clear
    if (commandName === 'clear') {
      if (!esStaff(member)) return sinPermisos(interaction);

      const cantidad = options.getInteger('cantidad');
      if (cantidad < 1 || cantidad > 100) {
        return interaction.reply({ content: '❌ Ingresa un número entre 1 y 100.', ephemeral: true });
      }

      await interaction.channel.bulkDelete(cantidad, true);
      return interaction.reply({ content: `✅ Se eliminaron **${cantidad}** mensajes.`, ephemeral: true });
    }

    // /reglas
    if (commandName === 'reglas') {
      const texto = [
        '# 📜 **REGLAS COLMILLOS DEL ALBA**',
        '',
        '## 🟣 **REGLAS DE DISCORD**',
        '',
        '### 1️⃣ 🔹 **Respeto y convivencia**',
        '> • Trata a todos con respeto.',
        '> • Nada de insultos, racismo o comportamiento tóxico. 🚫',
        '',
        '### 2️⃣ 🔹 **Chat ordenado**',
        '> • Evita el spam.',
        '> • No generes conflictos innecesarios.',
        '> • Mantén los canales según su función. 📂',
        '> • No envíes links de servidores externos. ❌',
        '',
        '### 3️⃣ 🔹 **Actividad**',
        '> • Permanece activo en el servidor.',
        '> • Tolerancia de **15 días** antes de ser expulsado por inactividad. ⏳',
        '> • Justifica tu inactividad con un líder si es necesario. 📝',
        '',
        '### 4️⃣ 🔹 **Conflictos y liderazgo**',
        '> • Los conflictos se resuelven con el Staff. 🛡️',
        '> • Sigue las decisiones de los líderes.',
        '> • Propón ideas de forma respetuosa.',
        '',
        '─────────────────────────────',
        '',
        '## 🟢 **REGLAS DE MINECRAFT (dioses.mc)**',
        '',
        '### 1️⃣ 🔹 **Roles y actividades**',
        '> • **Roles:** ⚔️ `PvP` | 🛠️ `Builder` | ⚙️ `Técnico` | ⚒️ `Herrero` | 🌾 `Farmer` ',
        '> • Apoya al clan en aventuras, guerras y construcciones.',
        '',
        '### 2️⃣ 🔹 **Trabajo en equipo**',
        '> • Comparte recursos cuando sea necesario. 💎',
        '> • Coordina ataques y defensas en equipo.',
        '',
        '### 3️⃣ 🔹 **Prohibido hacer trampas**',
        '> • Nada de hacks, cheats o exploits.',
        '> • ❌ Incumplir deriva en **expulsión** del clan y el Discord.',
        '',
        '### 4️⃣ 🔹 **Construcciones y territorio**',
        '> • ❌ No grifear ni destruir construcciones ajenas.',
        '> • Pide permiso antes de construir en zonas del clan. 🏗️',
        '',
        '─────────────────────────────',
        '',
        '## ⚖️ **SANCIONES**',
        '',
        '> 1️⃣ **Primera:** Mute de 5 horas',
        '> 2️⃣ **Segunda:** Mute de 1 día',
        '> 3️⃣ **Tercera:** ⚠️ Última advertencia — 3 días',
        '> 4️⃣ **Cuarta:** ❌ Expulsión del clan y del Discord',
        '',
        '*Las sanciones se aplican según la gravedad de la falta.*',
        '',
        '─────────────────────────────',
        '',
        '## 🏹 **LIDERAZGO DEL CLAN**',
        '',
        '👑 **Líder Principal:** <@777529808325181460>',
        '🥈 **Colíder General:** <@1042214255358910514>',
        '🛠️ **Líder de Construcción:** <@1157178540865896580>',
        '📐 **Colíder de Construcción:** <@722044088890818570>',
        '📐 **Colíder de Construcción:** <@793192075495473193>',
        '⚔️ **Líder de PvP:** <@1342606637185372173>',
        '🛡️ **Colíder de PvP:** <@1218952305274130505>',
        '⚙️ **Líder Técnico:** <@525815527117946892>',
        '📜 **Staff:** <@694919739688091680>',
        '📜 **Staff:** <@478093856668123148>',
        '',
        '─────────────────────────────',
        '🔥🌅 ¡Que **ColmillosdelAlba** crezca fuerte, unido y legendario! 🌅🐉'
      ].join('\n');

      return interaction.reply({
        content: '@everyone',
        embeds: [new EmbedBuilder()
          .setTitle('📜 REGLAS COLMILLOS DEL ALBA')
          .setDescription(texto)
          .setColor(0x8B0000)
        ],
        allowedMentions: { parse: ['everyone'] },
      });
    }

    // /miembros
    if (commandName === 'miembros') {
      const online = guild.members.cache.filter(
        m => m.presence?.status && m.presence.status !== 'offline'
      ).size;
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('👥 Estadísticas del Servidor')
          .setDescription(`🟢 **Online:** ${online}\n👥 **Total:** ${guild.memberCount}`)
          .setColor(0x00FF00)
        ],
      });
    }

    // /anunciar
    if (commandName === 'anunciar') {
      if (!esStaff(member)) return sinPermisos(interaction);

      const texto = options.getString('mensaje');
      const canalAvisos = guild.channels.cache.get(CONFIG.CANAL_AVISOS);
      if (!canalAvisos) return interaction.reply({ content: '❌ Canal de avisos no encontrado.', ephemeral: true });

      await canalAvisos.send({
        content: `<@&${CONFIG.ROL_AVISOS}>`,
        embeds: [new EmbedBuilder()
          .setTitle('📢 ANUNCIO OFICIAL')
          .setDescription(texto)
          .setColor(0xFF0000)
          .setTimestamp()
        ],
      });
      return interaction.reply({ content: '✅ Anuncio enviado.', ephemeral: true });
    }

    // /kick, /ban, /warn
    if (['kick', 'ban', 'warn'].includes(commandName)) {
      if (!esStaff(member)) return sinPermisos(interaction);

      const target = options.getUser('usuario');
      const razon  = options.getString('razon') ?? 'Sin razón especificada';
      const embed  = new EmbedBuilder()
        .setColor(0x8B0000)
        .setTimestamp()
        .setFooter({ text: `Staff: ${interaction.user.tag}` });

      if (commandName === 'kick') {
        await guild.members.kick(target, razon);
        embed.setTitle('👢 Usuario Expulsado').setDescription(`**Usuario:** ${target.tag}\n**Razón:** ${razon}`);
      } else if (commandName === 'ban') {
        await guild.members.ban(target, { reason: razon });
        embed.setTitle('🔨 Usuario Baneado').setDescription(`**Usuario:** ${target.tag}\n**Razón:** ${razon}`);
      } else {
        embed.setTitle('⚠️ Advertencia Emitida').setDescription(`**Usuario:** ${target.tag}\n**Razón:** ${razon}`);
      }

      return interaction.reply({ embeds: [embed] });
    }

    // /suggest
    if (commandName === 'suggest') {
      if (interaction.channel.id !== CONFIG.CANAL_COMANDOS) {
        return interaction.reply({ content: `❌ Este comando solo se puede usar en <#${CONFIG.CANAL_COMANDOS}>.`, ephemeral: true });
      }

      const texto = options.getString('texto');
      const canalSugerencias = await client.channels.fetch(CONFIG.CANAL_SUGERENCIAS).catch(() => null);
      if (!canalSugerencias) return interaction.reply({ content: '❌ Canal de sugerencias no encontrado.', ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle('📌 Nueva Sugerencia')
        .setDescription(texto)
        .setColor(0x8B0000)
        .setFooter({ text: `Sugerido por ${interaction.user.tag}` })
        .setTimestamp();

      const msg = await canalSugerencias.send({ embeds: [embed] });
      await msg.react('👍');
      await msg.react('👎');

      return interaction.reply({ content: '✅ Tu sugerencia fue enviada correctamente.', ephemeral: true });
    }

    // /stats
    if (commandName === 'stats') {
      const objetivo = options.getMember('usuario') ?? member;

      const fechaUnion = objetivo.joinedAt?.toLocaleDateString('es-ES', {
        year: 'numeric', month: 'long', day: 'numeric',
      }) ?? 'Desconocida';

      const roles = objetivo.roles.cache
        .filter(r => r.id !== guild.id)
        .map(r => `<@&${r.id}>`)
        .join(', ') || 'Ninguno';

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle(`📊 Estadísticas de ${objetivo.user.username}`)
          .setThumbnail(objetivo.user.displayAvatarURL({ dynamic: true }))
          .setColor(0x8B0000)
          .addFields(
            { name: '👤 Usuario',    value: objetivo.user.tag,       inline: true },
            { name: '🆔 ID',         value: objetivo.user.id,         inline: true },
            { name: '📅 Se unió',    value: fechaUnion,               inline: true },
            { name: '🛡️ Roles',     value: roles },
          )
          .setFooter({ text: `Consultado por ${interaction.user.tag}` })
          .setTimestamp()
        ],
      });
    }

    // /top
    if (commandName === 'top') {
      return interaction.reply({ content: '📊 Comando en desarrollo.', ephemeral: true });
    }

    // /sorteo
    if (commandName === 'sorteo') {
      if (!esStaff(member)) return sinPermisos(interaction);

      const premio   = options.getString('premio');
      const duracion = options.getInteger('duracion');

      const embed = new EmbedBuilder()
        .setTitle('🎉 ¡NUEVO SORTEO! 🎉')
        .setDescription(`**Premio:** ${premio}\n\nReacciona con 🎟️ para participar.\n**Duración:** ${duracion} minuto(s).`)
        .setColor(0x00FF00)
        .setFooter({ text: `Sorteo iniciado por ${interaction.user.username}` })
        .setTimestamp(Date.now() + duracion * 60_000);

      await interaction.reply({ content: '✅ Sorteo creado.', ephemeral: true });
      const msgSorteo = await interaction.channel.send({ content: '@everyone', embeds: [embed] });
      await msgSorteo.react('🎟️');

      setTimeout(async () => {
        const fetched   = await msgSorteo.fetch().catch(() => null);
        if (!fetched) return;

        const reactions  = fetched.reactions.cache.get('🎟️');
        const users      = reactions ? await reactions.users.fetch() : null;
        // ✅ FIX: filtramos bots correctamente antes de elegir ganador
        const participantes = users?.filter(u => !u.bot) ?? new Map();

        if (participantes.size === 0) {
          return interaction.channel.send('😞 No hubo participantes para el sorteo.');
        }

        const ganador = participantes.random();
        const logChannel = guild.channels.cache.get(CONFIG.CANAL_LOGS);

        await interaction.channel.send({
          content: '🎉 ¡El sorteo ha terminado!',
          embeds: [new EmbedBuilder()
            .setTitle('🏆 ¡Tenemos un Ganador! 🏆')
            .setDescription(`**Premio:** ${premio}\n\n¡Felicidades <@${ganador.id}>! 🎊\nGracias a todos por participar.`)
            .setColor(0xFFD700)
            .setThumbnail(ganador.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'Sorteo finalizado' })
            .setTimestamp()
          ],
        });

        logChannel?.send(`🏆 **${premio}** fue ganado por **${ganador.tag}**`);
      }, duracion * 60_000);

      return;
    }

    return; // Comando no reconocido — no hacer nada
  }

  // ── BOTONES ───────────────────────────────────────────────

  if (!interaction.isButton()) return;

  // Botón: Crear ticket
if (interaction.customId === 'crear_ticket') {
  // Cambiado de .id a .username para usar el nombre de usuario
  const nombreCanal  = `verificacion-${interaction.user.username}`;
  
  // Buscamos el canal asegurando que coincida en minúsculas
  const canalExiste  = interaction.guild.channels.cache.find(c => c.name === nombreCanal.toLowerCase());
  if (canalExiste) return interaction.reply({ content: '❌ Ya tienes un ticket abierto.', ephemeral: true });

  const nuevoCanal = await interaction.guild.channels.create({
    name:   nombreCanal,
    type:   ChannelType.GuildText,
    parent: CONFIG.CATEGORIA_TICKETS,
    topic:  interaction.user.id, // Mantenemos el ID aquí para que el Staff sepa quién es textualmente
    permissionOverwrites: [
      { id: interaction.guild.id,    deny:  [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id,     allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: CONFIG.STAFF_ROLE_ID,    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: CONFIG.STAFF_TICKETS_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: client.user.id,          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
    ],
  });

    const embedFormulario = new EmbedBuilder()
      .setTitle('⚔️ RECLUTAMIENTO: COLMILLOS DEL ALBA')
      .setDescription(
        '**Bienvenido aspirante.**\n\n' +
        'Buscamos jugadores activos con disciplina, constancia y lealtad.\n' +
        'Haz clic en **📝 Iniciar Formulario** para comenzar.\n\n' +
        '⚠️ **IMPORTANTE:**\n' +
        '> • Las solicitudes poco serias serán rechazadas.\n' +
        '> • Se evaluará actitud, nivel y compromiso.'
      )
      .addFields(
        { name: '📜 Requisito Mínimo', value: 'Micrófono y Discord activo.', inline: true },
        { name: '⏳ Evaluación',       value: 'El Staff revisará tu perfil.', inline: true },
      )
      .setColor(0x8B0000)
      .setImage(CONFIG.IMAGEN_FORMULARIO)
      .setFooter({ text: 'Forjamos lealtad y poder • Colmillos del Alba' })
      .setTimestamp();

    const fila1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('abrir_formulario').setLabel('📝 Iniciar Formulario').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('reclamar_ticket').setLabel('🙋‍♂️ Reclamar Ticket').setStyle(ButtonStyle.Primary),
    );
    const fila2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('aceptar_miembro').setLabel('Aceptar').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('rechazar_miembro').setLabel('Rechazar').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('cerrar_ticket').setLabel('Cerrar').setStyle(ButtonStyle.Secondary),
    );

    await nuevoCanal.send({
      content:    `<@&${CONFIG.STAFF_ROLE_ID}> <@${interaction.user.id}>`,
      embeds:     [embedFormulario],
      components: [fila1, fila2],
    });

    return interaction.reply({ content: `✅ Ticket creado en <#${nuevoCanal.id}>.`, ephemeral: true });
  }

  // Botón: Abrir formulario → primero muestra el select de especialidad
  if (interaction.customId === 'abrir_formulario') {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('select_especialidad')
      .setPlaceholder('Selecciona tu especialidad principal...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('⚔️ PvP').setValue('PvP').setDescription('Combate y guerras del clan'),
        new StringSelectMenuOptionBuilder().setLabel('🏗️ Builder').setValue('Builder').setDescription('Construcción y diseño'),
        new StringSelectMenuOptionBuilder().setLabel('⚙️ Técnico').setValue('Técnico').setDescription('Redstone y mecanismos'),
        new StringSelectMenuOptionBuilder().setLabel('⚒️ Herrero').setValue('Herrero').setDescription('Crafteo y encantamientos'),
        new StringSelectMenuOptionBuilder().setLabel('🌾 Farmer').setValue('Farmer').setDescription('Granjas y recursos'),
      );

    const fila = new ActionRowBuilder().addComponents(menu);

    return interaction.reply({
      content: '**¿Cuál es tu especialidad principal?**\nElige una opción para continuar con el formulario.',
      components: [fila],
      ephemeral: true,
    });
  }

  // Botón: Reclamar ticket
  if (interaction.customId === 'reclamar_ticket') {
    if (!esStaffTickets(interaction.member)) return sinPermisos(interaction);
    return interaction.reply({ content: `✅ Ticket reclamado por <@${interaction.user.id}>.` });
  }

  // Botones: Aceptar / Rechazar miembro
  if (interaction.customId === 'aceptar_miembro' || interaction.customId === 'rechazar_miembro') {
    if (!esStaffTickets(interaction.member)) return sinPermisos(interaction);

    const targetMember = await interaction.guild.members.fetch(interaction.channel.topic).catch(() => null);

    if (interaction.customId === 'aceptar_miembro') {
      if (targetMember) await targetMember.roles.add(CONFIG.CLAN_ROLE_ID).catch(() => {});
      await interaction.reply({ content: '✅ **ACEPTADO.** Rol de clan asignado. Cerrando ticket en 15s...' });
    } else {
      const embedRechazo = new EmbedBuilder()
        .setTitle('⚔️ ESTADO DE POSTULACIÓN: COLMILLOS DEL ALBA ⚔️')
        .setColor(0xFF0000)
        .setDescription(
          'Saludos aspirante.\n\n' +
          'Lamentamos informarte que, tras revisar tu postulación, **tu solicitud de ingreso ha sido rechazada**.\n\n' +
          'La decisión puede deberse a que no se cumplieron los requisitos establecidos en PvP, construcción o mecánicas técnicas, ' +
          'o al incumplimiento de normas básicas como la edad mínima solicitada.\n\n' +
          'Te invitamos a seguir mejorando y volver a intentarlo en futuras convocatorias.\n\n' +
          '*Atentamente, Administradores de ColmillosdelAlba*'
        )
        .setFooter({ text: 'Forjamos lealtad y poder.' })
        .setTimestamp();

      if (targetMember) await targetMember.send({ embeds: [embedRechazo] }).catch(() => {});
      await interaction.reply({ content: '❌ **RECHAZADO.** DM enviado. Cerrando ticket en 15s...' });
    }

    setTimeout(() => interaction.channel.delete().catch(() => {}), 15_000);
    return;
  }

  // Botón: Cerrar ticket
  if (interaction.customId === 'cerrar_ticket') {
    if (!esStaffTickets(interaction.member)) return sinPermisos(interaction);
    await interaction.reply({ content: '🔒 Cerrando ticket...' });
    setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
  }
});

// ============================================================
//  LOGIN
// ============================================================

client.login(process.env.TOKEN);
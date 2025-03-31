const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  REST,
  Routes,
} = require("discord.js");
require("dotenv").config();
const mysql = require("mysql2");
const { CLIENT_ID, GUILD_ID, BOT_TOKEN } = process.env;

// สร้างการเชื่อมต่อกับฐานข้อมูล MySQL
const connection = mysql.createConnection({
  host: "localhost", // ชื่อโอสต์ ไม่ต้องเปลี่ยนถ้าเอาไปไว้บนเครื่องเซิร์ฟเวอร์
  user: "root", // ไม่ต้องเปลี่ยน
  password: "", // รหัสผ่านฐานข้อมูล ไม่ต้องใส่ถ้าไม่ได้ตั้งรหัสผ่าน
  database: "", // ชื่อฐานข้อมูล
});

// เชื่อมต่อฐานข้อมูล
connection.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:" + err.stack);
    return;
  }
  console.log("Connected to the database");
});

// ลงทะเบียนคำสั่ง Slash
const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

(async () => {
  try {
    // ลงทะเบียนคำสั่ง Slash สำหรับเซิร์ฟเวอร์
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: [
        {
          name: "whitelist",
          description: "เรียกใช้งานบอทรับไวริส", // คำอธิบายคำสั่ง
        },
      ],
    });
    console.log("Slash command registered!");
  } catch (error) {
    console.error("Error registering slash commands:", error);
  }
})();

// สร้าง client ของ Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// บ็อตพร้อมใช้งาน
client.once("ready", () => {
  console.log("Bot is ready!");
});

// จัดการการโต้ตอบ (interaction)
client.on("interactionCreate", async (interaction) => {
  // ตรวจสอบว่าการโต้ตอบเป็นคำสั่ง Slash หรือไม่
  if (interaction.isCommand()) {
    if (interaction.commandName === "whitelist") {
      // สร้าง Embed สำหรับการแสดงผล
      const embed = new EmbedBuilder()
        .setColor("Blue")
        .setTitle("รับไวริสจร้าาา")
        .setURL("https://discord.js.org") // ลิงก์ (ตัวอย่าง)
        .setThumbnail("https://i.imgur.com/wSTFkRM.png") // รูปภาพย่อ
        .addFields({
          name: "เงื่อนไขในการรับไวริส",
          value:
            "```คุณจะต้องสมัครตัวละครในเกมของคุณให้เรียบร้อยก่อนจึงจะสามารถรับไวริสได้```",
          inline: true,
        })
        .setTimestamp()
        .setFooter({
          text: "Test X Discord",
          iconURL: "https://i.imgur.com/wSTFkRM.png",
        });

      // สร้างปุ่ม
      const button = new ButtonBuilder()
        .setCustomId("clickBtn") // กำหนด ID ปุ่ม
        .setLabel("🪪 รับไวริส")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(button);

      // ตอบกลับการโต้ตอบ
      await interaction.reply({ embeds: [embed], components: [row] });
    }
  }

  // จัดการการกดปุ่ม
  if (interaction.isButton()) {
    if (interaction.customId === "clickBtn") {
      // ตรวจสอบ Discord ID ในฐานข้อมูล
      const DiscordID = interaction.member.id;
      const [rows] = await connection
        .promise()
        .query("SELECT `DiscordID` FROM `verify_logs` WHERE DiscordID = ?", [
          DiscordID
        ]);

      if (rows.length > 0) {
        // ถ้า Discord ID ถูกใช้ไปแล้ว
        const embed = new EmbedBuilder()
          .setColor("Red")
          .setTitle("ไม่สำเร็จ ❌")
          .setDescription(`บัญชี Discord ของคุณได้รับไวริสแล้ว`);
        await interaction.reply({ embeds: [embed], flags: 64 });
        return; // หยุดการดำเนินการ
      }

      // ถ้า Discord ID ยังไม่ถูกใช้ แสดง Modal ให้กรอกชื่อในเกม
      const modal = new ModalBuilder()
        .setCustomId("modal_whitelist")
        .setTitle("กรอกข้อมูลเพื่อรับไวริส")
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("input_name") // กำหนด ID สำหรับ Input
              .setLabel("กรอกชื่อในเกมของคุณ")
              .setStyle(TextInputStyle.Short)
              .setRequired(true) // กำหนดว่า Input ต้องกรอกเสมอ
          )
        );

      // แสดง Modal
      await interaction.showModal(modal);
    }
  }

  // จัดการการส่งข้อมูลจาก Modal
  if (
    interaction.isModalSubmit() &&
    interaction.customId === "modal_whitelist"
  ) {
    const playerName = interaction.fields.getTextInputValue("input_name");

    // ดึงข้อมูลผู้เล่นจากฐานข้อมูล
    const [rows] = await connection
      .promise()
      .query("SELECT `playerName`, `playerWhitelist` FROM players WHERE playerName = ? AND playerWhitelist = 1", [
        playerName
      ]);
    const [rows2] = await connection.promise().query("SELECT `playerName` FROM players WHERE playerName = ?", [
        playerName
      ]);

    if (rows2.length === 0) {
      // ถ้าไม่พบชื่อในฐานข้อมูล
      const embed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("ไม่สำเร็จ ❌")
        .setDescription(`ชื่อ ${playerName} ไม่มีในระบบ โปรดตรวจสอบอีกครั้ง`);
      await interaction.reply({ embeds: [embed], flags: 64 });
    } else if (rows.length > 0) {
      // ถ้า Discord ID ถูกใช้ไปแล้ว
      const embed = new EmbedBuilder()
      .setColor("Red")
      .setTitle("ไม่สำเร็จ ❌")
      .setDescription(`ชื่อ ${playerName} ได้รับไวริสไปแล้ว`);
      await interaction.reply({ embeds: [embed], flags: 64 });
    }
    else {
      // ถ้าพบชื่อในฐานข้อมูล
      const DiscordID = interaction.member.id;
      let role =  interaction.member.guild.roles.cache.find(role => role.name === "ประชาชน"); // นำชื่อบทบาทมาใส่ในนี้ต้องตรงกับชื่อบทบาทในดิสคอร์ด

      // เพิ่มข้อมูลลงในตาราง verify
      await connection
        .promise()
        .query("INSERT INTO `verify_logs` (playerName, DiscordID) VALUES (?, ?)", [
          playerName,
          DiscordID,
        ]);

      // เพิ่ม playerWhitlist = 1
      await connection.promise().query(
        "UPDATE players SET playerWhitelist = 1 WHERE playerName = ?",
        [playerName]
      );
      const embed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("สำเร็จ ✅")
        .setDescription(
          `คุณ ${playerName} ได้รับไวริสเรียบร้อยแล้ว! สนุกกับการเล่นเกม 🎉`
        );
      // เปลี่ยนชื่อดิสคอร์ดตามชื่อในเกม
      await interaction.member.setNickname(playerName);
      await interaction.member.roles.add(role);
      
      await interaction.reply({ embeds: [embed], flags: 64 });
    }
  }
});

// โทเคนของบอท ไปแก้ที่ไฟล์ .env
client.login(BOT_TOKEN);

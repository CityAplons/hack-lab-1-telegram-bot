"use strict";
const {readFileSync} = require('fs')
const {Telegraf} = require('telegraf')
const {
    Extra,
    Markup,
    Stage
  } = Telegraf
const {MenuTemplate, MenuMiddleware, createBackMainMenuButtons} = require('telegraf-inline-menu')
const LocalSession = require('telegraf-session-local')

const bot = new Telegraf("TG_TOKEN")

/*
 * User local database
 */
bot.use((new LocalSession({ database: '_users_db.json' })).middleware())

/*
 * Scenes (Quest, Buildings)
 */
const SceneGenerator = require('./scenes')
const curScene = new SceneGenerator()
const questScene = curScene.genQuestScene()
const boolQuestScene = curScene.genBoolQuestScene()
const luckScene = curScene.genluckScene()

const stage = new Stage([questScene, boolQuestScene, luckScene])
stage.command('home', async (ctx) => {
    await ctx.scene.leave()
    ctx.reply('Вы вернулись домой')
    menuMiddleware.replyToContext(ctx)
})
bot.use(stage.middleware())

/*
 * User interface
 */

const menuTemplate = new MenuTemplate(ctx => `
👋Привет, капиталист!
💪Хочешь проверить свои знания в финансах и узнать интересные факты?  
⛔️Не боишься остаться ни с чем?
💰Готов за короткий срок стать миллионером?

Если да, то эта игра для тебя! 
👀Подробности /instructions `)

//States
let mainMenuToggle = false
let luckButtonToggle = false
let statsMenuToggle = false

/*
 * Player data
 */
const fields = JSON.parse(readFileSync('_data_db.json'));
const levelFields = fields.levels
const baselFields = fields.bases
/*
 * Statistics submenu
 */
const statsMenu = new MenuTemplate((ctx) => {
    if (ctx.session.lastVision) {
        let add = Math.floor(parseFloat(new Date() - new Date(ctx.session.lastVision))/1000)*ctx.session.multiplier*Math.pow(5,(ctx.session.leve-1))
        if(!isNaN(add)) ctx.session.coinsAmount += add
        ctx.session.lastVision = new Date();
    }
    return `Токены: ${ctx.session.coinsAmount}🟡\nМесто работы: ${baselFields[ctx.session.base].name}\nБонусный множитель: ${baselFields[ctx.session.base].rate}\nТвой уровень: ${ctx.session.level} - ${levelFields[ctx.session.level-1].role}
${levelFields[ctx.session.level].description}`;
})
statsMenu.manualRow(createBackMainMenuButtons("Назад", "В меню"))
menuTemplate.submenu('Прогресс', 'amount', statsMenu, {
	hide: () => mainMenuToggle
})

/*
 * Upgrade submenu
 */
const upgradeMenu = new MenuTemplate((ctx) => {
    return `Обновить рабочее место - ${baselFields[ctx.session.base+1].name} ${baselFields[ctx.session.base+1].price}🟡`;
})
upgradeMenu.interact('Купить', 'buyUpgradeBase', {
    do: async ctx => {
        if(ctx.session.coinsAmount >= baselFields[ctx.session.base+1].price) {
            ctx.session.coinsAmount -= baselFields[ctx.session.base+1].price
            ctx.session.base += 1
            ctx.session.multiplier = baselFields[ctx.session.base].rate;
            ctx.reply(`Вы перехали в ${baselFields[ctx.session.base].name}, теперь заработок в х${baselFields[ctx.session.base].rate} раз выше!`)
        } else {
            ctx.reply(`Не хватает токенов! 😡`)
        }
    
        return true;
    }
})
upgradeMenu.manualRow(createBackMainMenuButtons("Назад", "В меню"))
statsMenu.submenu('Обновить рабочее место', 'upgradeBase', upgradeMenu, {
	hide: () => statsMenuToggle
})

/*
 * Play submenu
 */
const playMenu = new MenuTemplate(ctx => {
    if ((new Date() - new Date(ctx.session.lastLuckRun)) >= 120000) luckButtonToggle = false
    else luckButtonToggle = true
    return `Ваш баланс: ${ctx.session.coinsAmount}🟡\n🕹🎮Выберите игровой режим и заплатите за участие из своего кармана💸!\n❓❓Вопрос: 150🟡\n🟢🔴Правда или Ложь: 10🟡\n🎯🎲Испытать фортуну: доступно 1 раз в день🕰`
})
playMenu.interact('Вопросы', 'quest', {
    do: async ctx => {
        ctx.reply(`Чтобы отвечать на вопросы, пишите числа от 1 до 4. \nИспользуйте /home для выхода в главное меню`)
        ctx.scene.enter('quest')
        return true;
    }
})
playMenu.interact('Правда/Ложь', 'boolQuest', {
    do: async ctx => {
        ctx.reply(`Чтобы отвечать на вопросы, отвечайте Да или Нет. \nИспользуйте /home для выхода в главное меню`)
        ctx.scene.enter('boolQuest')
        return true;
    }
})
playMenu.interact('Испытать фортуну', 'luck', {
    hide: () => {
        if (luckButtonToggle) return true 
        else return false;
    },
    do: async ctx => {
        luckButtonToggle = true
        ctx.scene.enter('luck')
        return true;
    }
})
playMenu.manualRow(createBackMainMenuButtons("Назад", "В меню"))
menuTemplate.submenu('Играть', 'play', playMenu, {
	hide: () => mainMenuToggle
})

/*
 * Level progression
 */
bot.use(async (ctx, next) => {
    if (ctx.session.level) {
        if(ctx.session.wins >= levelFields[ctx.session.level-1].wins) {
            ctx.session.level += 1
            ctx.reply(`🎉 Ваш уровень вырос! Теперь вы ${levelFields[ctx.session.level-1].role} 🎉`)
            ctx.session.wins = 0
        }
    }
    return next();
})

/*
 * Bot reactions
 */
const menuMiddleware = new MenuMiddleware('/', menuTemplate)
bot.command('start', ctx => {
    ctx.session.coinsAmount = ctx.session.coinsAmount || 200;
    ctx.session.wins = ctx.session.wins || 0;
    ctx.session.base = ctx.session.base || 0;
    ctx.session.level = ctx.session.level || 1;
    ctx.session.multiplier = baselFields[ctx.session.base].rate;
    ctx.session.lastVision = ctx.session.lastVision || new Date();
    ctx.session.lastLuckRun = ctx.session.lastLuckRun || new Date();
    ctx.session.restart_quest = true
    ctx.session.restart_tf = true
    menuMiddleware.replyToContext(ctx)
})
bot.use(menuMiddleware)
bot.command('instructions',(ctx) => ctx.reply(`В этой игре тебе необходимо правильно отвечать на вопросы, зарабатывать деньги и развивать свой бизнес!
Для нового уровня нужно правильно ответить ${levelFields[ctx.session.level-1].wins - ctx.session.wins} раз`))
bot.on('sticker', (ctx) => ctx.reply('👍'))
bot.hears('привет', (ctx) => ctx.reply('Ну здарова, меченный'))
bot.launch()
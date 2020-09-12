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
const investFields = fields.invests
/*
 * Statistics submenu
 */
const statsMenu = new MenuTemplate((ctx) => {
    return `Токены: ${ctx.session.coinsAmount.toFixed(3)}🟡\nМесто работы: ${baselFields[ctx.session.base].name}\nБонусный множитель: ${ctx.session.base}\nТвой уровень: ${ctx.session.level} -> ${levelFields[ctx.session.level].role}
${levelFields[ctx.session.level].description}`;
})
statsMenu.manualRow(createBackMainMenuButtons("Назад", "В меню"))
menuTemplate.submenu('Прогресс', 'amount', statsMenu, {
	hide: () => mainMenuToggle
})

/*
 * Upgrade base submenu
 */
const upgradeMenu = new MenuTemplate((ctx) => {
    return `Обновить рабочее место - ${baselFields[ctx.session.base+1].name} ${baselFields[ctx.session.base+1].price}🟡`;
})
upgradeMenu.interact('Купить', 'buyUpgradeBase', {
    do: async ctx => {
        if(ctx.session.coinsAmount >= baselFields[ctx.session.base+1].price) {
            ctx.session.coinsAmount -= baselFields[ctx.session.base+1].price
            ctx.session.base += 1
            ctx.reply(`Вы перехали в ${baselFields[ctx.session.base].name}!`)
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
 * Upgrade timer submenu
 */
const upgradeTimerMenu = new MenuTemplate((ctx) => {
    let startupsString = ""
    for (let index = ctx.session.counterLevel; index > 0; index--) {
        startupsString += `${investFields[index].name}; `;
    }
    return `Увеличить прибыль, проинвестировав в "${investFields[ctx.session.counterLevel+1].name}" ${investFields[ctx.session.counterLevel+1].price*Math.pow(5,ctx.session.base)}🟡\nПрибыль увеличится на ${investFields[ctx.session.counterLevel+1].rate*Math.pow(5,ctx.session.base)} 🟡 в сек.
Текущие инвестиции: ${startupsString} Прибыль ${(investFields[ctx.session.counterLevel+1].rate+1)*Math.pow(5,(ctx.session.base))} 🟡 в сек.`;
})
upgradeTimerMenu.interact('Инвестировать', 'buyUpgradeTimer', {
    do: async ctx => {
        if(ctx.session.coinsAmount >= investFields[ctx.session.counterLevel+1].price*Math.pow(5,ctx.session.base)) {
            ctx.session.coinsAmount -= investFields[ctx.session.counterLevel+1].price*Math.pow(5,ctx.session.base)
            ctx.session.counterLevel += 1
            ctx.reply(`Вы инвестировали в ${investFields[ctx.session.counterLevel].name}, теперь заработок на ${investFields[ctx.session.counterLevel].rate*Math.pow(5,ctx.session.base)}🟡 в сек. раз выше!`)
        } else {
            ctx.reply(`Не хватает токенов! 😡`)
        }
    
        return true;
    }
})
upgradeTimerMenu.manualRow(createBackMainMenuButtons("Назад", "В меню"))
statsMenu.submenu('Инвестировать', 'upgradeTimer', upgradeTimerMenu, {
	hide: () => statsMenuToggle
})

/*
 * Play submenu
 */
const playMenu = new MenuTemplate(ctx => {
    return `Ваш баланс: ${ctx.session.coinsAmount.toFixed(3)}🟡\n🕹🎮Выберите игровой режим и заплатите за участие из своего кармана💸!\n❓❓Вопрос: 150🟡\n🟢🔴Правда или Ложь: 10🟡\n🎯🎲Испытать фортуну: доступно 1 раз в день🕰 Стоимость ${200*ctx.session.level}🟡`
})
playMenu.interact('Вопросы', 'quest', {
    do: async ctx => {
        if (ctx.session.coinsAmount >= 150) {
            await ctx.reply(`Чтобы отвечать на вопросы, пишите числа от 1 до 4. \nИспользуйте /home для выхода в главное меню`)
            ctx.scene.enter('quest')
        } else {
            await ctx.reply("Не хвататет 🟡")
        }
        return true;
    }
})
playMenu.interact('Правда/Ложь', 'boolQuest', {
    do: async ctx => {
        if (ctx.session.coinsAmount >= 10) {
            await ctx.reply(`Чтобы отвечать на вопросы, отвечайте Да или Нет. \nИспользуйте /home для выхода в главное меню`)
            ctx.scene.enter('boolQuest')
        } else {
            await ctx.reply("Не хвататет 🟡")
        }
        return true;
    }
})
playMenu.interact('Испытать фортуну', 'luck', {
    hide: () => {
        if (luckButtonToggle) return true 
        else return false;
    },
    do: async ctx => {
        if (ctx.session.coinsAmount >= 200*ctx.session.level) {
            luckButtonToggle = true
            ctx.scene.enter('luck')
        } else {
            await ctx.reply("Не хвататет 🟡")
        }
        
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
    //Level
    if (ctx.session.level) {
        if(ctx.session.wins >= levelFields[ctx.session.level].wins && ctx.session.base >= 1) {
            ctx.session.level += 1
            ctx.reply(`🎉 Ваш уровень вырос! Теперь вы ${levelFields[ctx.session.level].role} 🎉`)
            ctx.session.wins = 0
        }
    }
    //Timer
    if (ctx.session.lastVision) {
        let add = (new Date() - new Date(ctx.session.lastVision))/1000
        add += (investFields[ctx.session.counterLevel+1].rate+1)*add*Math.pow(5,(ctx.session.base))
        if(!isNaN(add)) ctx.session.coinsAmount += add
        ctx.session.wins += add
        ctx.session.lastVision = new Date();
    }
    //Lower than 0
    if (ctx.session.coinsAmount < 0) {
        ctx.session.coinsAmount = 0
    }
    //Luck timer
    if ((new Date() - new Date(ctx.session.lastLuckRun)) >= 24*60*60*1000) luckButtonToggle = false
    else luckButtonToggle = true
    return next();
})

/*
 * Bot reactions
 */
const menuMiddleware = new MenuMiddleware('/', menuTemplate)
bot.command('start', ctx => {
    ctx.session.coinsAmount = ctx.session.coinsAmount || 10;
    ctx.session.wins = ctx.session.wins || 0;
    ctx.session.base = ctx.session.base || 0;
    ctx.session.level = ctx.session.level || 1;
    ctx.session.counterLevel = ctx.session.counterLevel || 0;
    ctx.session.lastVision = ctx.session.lastVision || new Date();
    ctx.session.lastLuckRun = ctx.session.lastLuckRun || new Date();
    ctx.session.restart_quest = true
    ctx.session.restart_tf = true
    menuMiddleware.replyToContext(ctx)
})
bot.use(menuMiddleware)
bot.command('instructions',(ctx) => ctx.reply(`В этой игре тебе необходимо правильно отвечать на вопросы, зарабатывать деньги и развивать свой бизнес!
Для нового уровня нужно заработать ${levelFields[ctx.session.level].wins - ctx.session.wins}🟡`))
bot.on('sticker', (ctx) => ctx.reply('👍'))
bot.hears('привет', (ctx) => ctx.reply('Ну здарова, меченный'))
bot.launch()
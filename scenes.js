"use strict";
const {readFileSync} = require('fs')
const Scene = require('telegraf/scenes/base')
const questdata = readFileSync('_questions_db.json');
let questions = JSON.parse(questdata).questions;
let boolQuestions = JSON.parse(questdata).binaries;

/**
 * Returns a random number between min (inclusive) and max (exclusive)
 */
function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array
}

function fetchQuestion(userProgression){
    return shuffleArray(userProgression).shift()
}

class SceneGenerator {
    genQuestScene () {
        const quest = new Scene('quest')
        let queue = questions
        quest.enter(async (ctx) => {
            if(ctx.session.restart_quest == true) {
                ctx.session.queue = Array.from(queue)
                ctx.session.restart_quest = false
            }
            let question = fetchQuestion(ctx.session.queue)
            if (question === undefined) {
                await ctx.reply(`Вы ответили на все вопросы. Используйте /home для выхода`)
                ctx.session.restart_quest = true
            } else {
                ctx.session.coinsAmount -= 150
                if (question.img) {
                    ctx.scene.session.img = question.img
                }
                if (question.desc) {
                    ctx.scene.session.desc = question.desc
                }
                ctx.session.answer = question.answer
                await ctx.reply(`${question.body} \n\t1)${question.variants[0]} \n\t2)${question.variants[1]} \n3)\t${question.variants[2]}\n4)\t${question.variants[3]} `)
            }
        })
        quest.on('text', async (ctx) => {
            const currAnswer = Number(ctx.message.text)
            if (currAnswer && currAnswer > 0  && currAnswer < 5) {
                if (currAnswer === ctx.session.answer) {
                    ctx.session.wins += 500
                    ctx.session.coinsAmount += 500
                    await ctx.reply(`Правильный ответ, вы получаете +500 токенов.`)
                } else if(currAnswer !== ctx.session.answer){
                    await ctx.reply(`Промах 🥺`)
                }

                if (ctx.scene.session.img && ctx.scene.session.desc) {
                    await ctx.replyWithPhoto({ source: ctx.scene.session.img }, {caption : ctx.scene.session.desc })
                }
                if (ctx.scene.session.img && !ctx.scene.session.desc) {
                    await ctx.replyWithPhoto({ source: ctx.scene.session.img })
                }
                if (!ctx.scene.session.img && ctx.scene.session.desc) {
                    await ctx.reply(ctx.scene.session.desc)
                }
                
                ctx.session.answer = undefined
                ctx.scene.reenter()
            } else {
                await ctx.reply('Это не номер ответа')
                ctx.scene.reenter()
            }
        })
        quest.on('message', (ctx) => ctx.reply('Давай лучше ответ'))
        return quest
    }

    genBoolQuestScene () {
        const boolQuest = new Scene('boolQuest')
        let queue = boolQuestions
        boolQuest.enter(async (ctx) => {
            if(ctx.session.restart_tf == true) {
                console.log(queue.length)
                ctx.session.queue = Array.from(queue)
                ctx.session.restart_tf = false
            }
            const question = fetchQuestion(ctx.session.queue)
            if (question === undefined) {
                await ctx.reply(`Вы ответили на все вопросы. Используйте /home для выхода`)
                ctx.session.restart_tf = true
            } else {
                ctx.session.coinsAmount -= 10
                if (question.img) {
                    ctx.scene.session.img = question.img
                }
                if (question.desc) {
                    ctx.scene.session.desc = question.desc
                }
                ctx.session.answer = question.answer
                await ctx.reply(`${question.body}\n`)
            }
        })
        boolQuest.on('text', async (ctx) => {
            const currAnswer = ctx.message.text.toLowerCase()
            if (currAnswer && (currAnswer == "да" || currAnswer == "нет" )) {
                if (currAnswer === ctx.session.answer) {
                    ctx.session.wins += 50
                    ctx.session.coinsAmount += 50
                    await ctx.reply(`Правильный ответ, вы получаете +50 токенов.`)
                } else if(currAnswer !== ctx.session.answer){
                    await ctx.reply(`Промах 🥺`)
                }

                if (ctx.scene.session.img && ctx.scene.session.desc) {
                    await ctx.replyWithPhoto({ source: ctx.scene.session.img }, {caption : ctx.scene.session.desc })
                }
                if (ctx.scene.session.img && !ctx.scene.session.desc) {
                    await ctx.replyWithPhoto({ source: ctx.scene.session.img })
                }
                if (!ctx.scene.session.img && ctx.scene.session.desc) {
                    await ctx.reply(ctx.scene.session.desc)
                }
                
                ctx.session.answer = undefined
                ctx.scene.reenter()
            } else {
                await ctx.reply('Допустимые ответы: да/нет')
                ctx.scene.reenter()
            }
        })
        boolQuest.on('message', (ctx) => ctx.reply('Давай лучше ответ'))
        return boolQuest
    }

    genluckScene () {
        const luck = new Scene('luck')
        luck.enter(async (ctx) => {
            ctx.session.coinsAmount -= 200*ctx.session.level
            let win = fetchQuestion([50,100,200,300,500])*ctx.session.level
            const res = Math.random() >= 0.1;
            if (res) {
                win = 10000 * ctx.session.level;
                ctx.session.coinsAmount += win;
                await ctx.reply(`Сегодня удача на вашей стороне!\nВы выйграли СУПЕРПРИЗ: ${win} токенов`)
            } else {
                ctx.session.coinsAmount += win * ctx.session.level;
                await ctx.reply(`Вы выйграли: ${win} токенов`)
            }
            
            ctx.session.lastLuckRun = new Date()
            ctx.scene.leave()
        })
        return luck;
    }

}

module.exports = SceneGenerator
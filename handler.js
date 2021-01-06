'use strict';
const { get } = require('axios')
class Handler {
  constructor({ rekoSvc, translatorSvc }){
    this.rekoSvc = rekoSvc
    this.translatorSvc = translatorSvc
  }
  async getImageBuffer(imageUrl){
    const response = await get(imageUrl,{
      responseType: 'arraybuffer'
    })
    const buffer = Buffer.from(response.data, 'base64')
    return buffer
  }
  async detectImageLabels(buffer){
    const result = await this.rekoSvc.detectLabels({
      Image:{
        Bytes: buffer
      }
    }).promise()
    const workingItens = result.Labels.filter(({Confidence})=>Confidence>80)
    const names = workingItens.map(({Name})=>Name).join(' e ')
    return { names, workingItens }
  }
  async translateText(text){
    const params = {
      SourceLanguageCode: 'en',
      TargetLanguageCode: 'pt',
      Text: text
    }
    const res = await this.translatorSvc.translateText(params).promise()
    return res.TranslatedText
  }
  formatTextResults(texts, workingItens){
    const finalText = []
    for(const indexText in texts){
      const nameInPortuguese = texts[indexText]
      const confidence = workingItens[indexText].Confidence
      finalText.push(
        `${confidence.toFixed(2)}% de ser do tipo ${nameInPortuguese}`
      )
    }
    return finalText.join('\n')
  }
  async main(event){
    try{
      if(!event.queryStringParameters || !event.queryStringParameters.imageUrl){
        return {
          statusCode: 403,
          body: 'Invalid imageUrl'
        }
      }
      const { imageUrl } = event.queryStringParameters
      const imgBuffer = await this.getImageBuffer(imageUrl)
      const { names, workingItens } = await this.detectImageLabels(imgBuffer)
      const texts = await this.translateText(names)
      const finalText = this.formatTextResults(texts.split(' e '), workingItens)      

      return {
        statusCode: 200,
        body: `A imagem tem\n `.concat(finalText)
      }
    }catch(err){
      return {
        statusCode: 500,
        body: `Internal Server Error `
      }
    }
  }
}

const aws = require('aws-sdk')
const reko = new aws.Rekognition()
const translator = new aws.Translate()
const handler = new Handler({
  rekoSvc: reko,
  translatorSvc: translator
})

module.exports.main = handler.main.bind(handler)
import { load } from 'cheerio'

type Article = {
  rank: number | null
  title: string
  link: string | null
  author: string | null
  age: string
  points: number | null
  comments: number | null
}
const page = process.env.page || 1

export const handler = async (event: any = {}): Promise<any> => {
  console.log(event)
  const hackerNewPage = await fetch(`https://news.ycombinator.com/?p=${page}`)
  const data = await hackerNewPage.text()

  const $ = load(data)
  const pageContent: Article[] = []

  $('.athing').each((_index, el) => {
    const article = $(el)
    const subline = article.next()

    const rank = article.find('.title > .rank').text()
    const author = subline.find('.hnuser').text().trim()
    const points = subline.find('.score').text()
    const comments = subline.find('a').last().text()

    pageContent.push({
      rank: rank ? Number(rank.replace('.', '')) : null,
      title: article.find('.title').find('a').first().text(),
      link: article.find('.titleline a').attr('href') ?? null,
      author: author.length ? author : null,
      age: subline.find('.age').text(),
      points: points ? Number(points.replace(' points', '')) : null,
      comments: comments.includes('comments')
        ? Number(comments.replace('comments', '').trim())
        : null,
    })
  })

  return {
    // Just grab the top 5 articles
    Body: pageContent.slice(0, 5),
  }
}

export const handler = async (event: any = {}): Promise<any> => {
  console.log(event)
  // TODO: actually write the code for this function

  return {
    statusCode: 200,
    body: 'Hacker News function response',
  }
}

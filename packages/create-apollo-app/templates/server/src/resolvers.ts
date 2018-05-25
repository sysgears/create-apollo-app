export default {
  Query: {
    salutation(obj: any, { subject }: { subject: string }) {
      return `Hello, ${subject}!`;
    }
  }
};

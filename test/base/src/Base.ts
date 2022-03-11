import { Readable } from "stream"
export class UserOptions {
  name: string
  phone: number;
  email: string;
}

/**
 * Simple test interface for cli-creator
 */
export interface IHello {
  /**
   * Says hello
   */
  sayHello(): string;

  /**
   * Prints content from a readable stream
   * @param str Readable stream 
   */
  echoReadable(str: Readable): Promise<string>;

  /**
 * Prints content from a buffer
 * @param buf Content buffer
 */
  echoBuffer(buf: Buffer): Promise<string>;

}

export class HelloWorld implements IHello {
  sayHello(): string {
    return "Hello World";
  }
  async echoReadable(str: Readable): Promise<string> {
    return await getStreamContent(str);
  }

  async echoBuffer(str: Buffer): Promise<string> {
    return str.toString();
  }

}

export class HelloUniverse implements IHello {
  sayHello(): string {
    return "Hello Universe";
  }
  async echoReadable(str: Readable): Promise<string> {
    return await getStreamContent(str);
  }

  async echoBuffer(str: Buffer): Promise<string> {
    return str.toString();
  }
}

export class HelloFactory {
  static create(opts) {
    if (opts?.scope == "world") return new HelloWorld();
    else return new HelloUniverse();
  }
}

async function getStreamContent(str: Readable) {
  let contents = "";
  for await (const chunk of str) {
    contents += chunk.toString();
  }
  return contents;
}
export class UserOptions {
  name : string
  phone: number;
  email: string;
}

export interface IHello {
  sayHello() : string;
}

export class HelloWorld implements IHello {
  sayHello() : string {
      return "Hello World";
  }
}

export class HelloUniverse implements IHello {
  sayHello() : string {
      return "Hello Universe";
  }
}

export class HelloFactory {
   static create(opts) {
    if (opts?.scope == "world") return new HelloWorld();
    else return new HelloUniverse();
  }
}
import { UserOptions, HelloWorld, HelloUniverse } from "base";
/**
 * Type of order
 */
export type ordertype = "dine-in" | "pickup" | "delivery";

/**
 * Type of pizza
 */
export type pizzatype = "cheese" | "pepperoni"

/**
 * Order options
 */
export class OrderOptions extends UserOptions {
  /**
   * Indicates if you want thick crust pizza
   */
  thickCrust?: boolean;
  orderType?: ordertype;
}

export class Order {
  id: number;
  customerName: string;
  status: "placed" | "being-prepared" | "complete" | "delivered" = "placed";
  constructor(id: number, name: string) {
    this.id = id;
    this.customerName = name;
  }
}

/**
 * Pizza order management
 */
export class PizzaShop {
  orderCounter: number = 0;
  orders = {};

  /**
   * Place a new order
   * @param customerName - Customer name
   * @param pizzaType Type of pizza
   * @param quantity - Number of pizzas. Default is 1
   * @param options - Order options
   * @returns Order object
   */
  placeOrder(customerName: string, pizzaType: pizzatype, quantity: number = 1, options?: OrderOptions): Order {
    let order: Order = new Order(this.orderCounter, customerName);
    this.orders['o' + order.id] = order;
    this.orderCounter++;
    return order;
  }

  /**
   * 
   * @param id - Order ID
   * @param name - Customer name associated with the order
   * @returns true if the order was successfully canceled
   * @throws Error if the id and customer name does not match
   */
  cancelOrder(id: number, name: string): boolean {
    let order: Order = this.orders['o' + id];
    if (!order) return false;
    if (order.customerName == name) {
      this.orders['o' + id] = undefined;
      return true;
    } else {
      throw new Error("Order does not belong to this customer.");
    }
  }

  /**
   * List current orders
   * @returns Array listing all orders
   */
  listOrders(): Order[] {
    let orders: Order[] = [];
    let ids: string[] = Object.keys(this.orders);
    for (let i = 0; i < ids.length; i++) {
      if (this.orders[ids[i]]) orders.push(this.orders[ids[i]]);
    }
    return orders;
  }
}

export class TestFactory {
  static create(opts, moduleName) {
    if (moduleName == "i-hello") {
      if (opts?.scope == "world") return new HelloWorld();
      else return new HelloUniverse();
    } else {
      return new PizzaShop();
    }
  }
}
// Generic object pool. Lanes and their hazards are recycled instead of reallocated.

export class Pool {
  constructor(create) {
    this.create = create;
    this.free = [];
  }
  get() {
    return this.free.pop() || this.create();
  }
  release(obj) {
    this.free.push(obj);
  }
}

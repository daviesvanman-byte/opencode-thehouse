import {
  World, Body, Sphere, Box, Vec3, type BodyOptions,
  NaiveBroadphase, GSSolver,
} from 'cannon-es';

export class PhysicsWorld {
  readonly world: World;
  private bodies = new Map<object, Body>();

  constructor() {
    this.world = new World();
    this.world.gravity.set(0, -9.82, 0);
    this.world.broadphase = new NaiveBroadphase();
    (this.world.solver as GSSolver).iterations = 10;
    this.world.defaultContactMaterial.friction = 0.3;
  }

  addBox(pos: [number, number, number], size: [number, number, number], staticBody = true): Body {
    const opts: BodyOptions = {
      shape: new Box(new Vec3(size[0] / 2, size[1] / 2, size[2] / 2)),
      position: new Vec3(pos[0], pos[1], pos[2]),
      type: staticBody ? Body.STATIC : Body.DYNAMIC,
    };
    const body = new Body(opts);
    this.world.addBody(body);
    return body;
  }

  addSphere(pos: [number, number, number], radius: number, mass = 1): Body {
    const body = new Body({
      shape: new Sphere(radius),
      position: new Vec3(pos[0], pos[1], pos[2]),
      mass,
    });
    this.world.addBody(body);
    return body;
  }

  addCapsuleLike(pos: [number, number, number], radius: number, height: number, mass = 1): Body {
    const body = new Body({
      shape: new Sphere(radius),
      position: new Vec3(pos[0], pos[1] + height / 2, pos[2]),
      mass,
    });
    this.world.addBody(body);
    return body;
  }

  register(key: object, body: Body) {
    this.bodies.set(key, body);
  }

  getBody(key: object): Body | undefined {
    return this.bodies.get(key);
  }

  step(dt: number) {
    this.world.step(1 / 60, dt, 3);
  }

  setPosition(key: object, x: number, y: number, z: number) {
    const body = this.bodies.get(key);
    if (body) {
      body.position.set(x, y, z);
    }
  }

  setVelocity(key: object, x: number, y: number, z: number) {
    const body = this.bodies.get(key);
    if (body) {
      body.velocity.set(x, y, z);
    }
  }

  getPosition(key: object): [number, number, number] | null {
    const body = this.bodies.get(key);
    return body ? [body.position.x, body.position.y, body.position.z] : null;
  }

  getVelocity(key: object): [number, number, number] | null {
    const body = this.bodies.get(key);
    return body ? [body.velocity.x, body.velocity.y, body.velocity.z] : null;
  }

}

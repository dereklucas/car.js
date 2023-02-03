(() => {
  /* global requestAnimationFrame, io */

  // Physics

  const maxVelocity = 1.42;
  const maxPower = 0.075;
  const maxReverse = 0.0375;
  const powerFactor = 0.001;
  const reverseFactor = 0.0005;

  const drag = 0.95;
  const angularDrag = 0.95;
  const turnSpeed = 0.002;

  const WIDTH = 1500;
  const HEIGHT = 1500;

  const $canvas = document.querySelector("canvas");

  $canvas.width = WIDTH;
  $canvas.height = HEIGHT;

  const ctx = $canvas.getContext("2d");

  ctx.fillStyle = "hsla(0, 0%, 25%, 0.25)";

  const $scene = document.querySelector(".scene");
  const $cars = document.querySelector(".cars");
  const $map = document.querySelector(".map");
  const $bullets = document.querySelector(".bullets");

  const $points = document.querySelector(".points");

  const localCar = {
    $el: document.querySelector(".car"),
    x: WIDTH / 2,
    y: HEIGHT / 2,
    xVelocity: 0,
    yVelocity: 0,
    power: 0,
    reverse: 0,
    angle: 0,
    angularVelocity: 0,
    isThrottling: false,
    isReversing: false,
    isShooting: false,
    points: 0,
  };

  const scene = {
    x: window.innerWidth / 2 - localCar.x,
    y: window.innerHeight / 2 - localCar.y,
  };

  const cars = [localCar];
  const carsById = {};

  const DEBUG = window.location.search === "?test";
  if (DEBUG) {
    cars.push({
      ...localCar,

      x: Math.random() * (WIDTH / 2) + WIDTH / 4,
      y: Math.random() * (HEIGHT / 2) + HEIGHT / 4,
      power: 0.5,
      isTurningLeft: true,
      isThrottling: true,
    });
    cars[1].$el = cars[0].$el.cloneNode(true);
    cars[0].$el.parentNode.appendChild(cars[1].$el);
  }

  const bullets = [];

  function updateCar(car, i) {
    if (car === localCar) {
      if (car.isHit) {
        car.isHit = false;
        car.xVelocity = clamp(
          car.xVelocity * -2,
          -1 * maxVelocity,
          maxVelocity
        );
        car.yVelocity = clamp(
          car.yVelocity * -2,
          -1 * maxVelocity,
          maxVelocity
        );
        sendParams(localCar);
      }

      if (car.isShot) {
        car.isShot = false;
        car.x = Math.random() * WIDTH;
        car.y = Math.random() * HEIGHT;
        car.xVelocity = 0;
        car.yVelocity = 0;
        sendParams(localCar);
      }
    }

    if (car.isThrottling) {
      car.power += powerFactor * car.isThrottling;
    } else {
      car.power -= powerFactor;
    }
    if (car.isReversing) {
      car.reverse += reverseFactor;
    } else {
      car.reverse -= reverseFactor;
    }

    car.power = clamp(car.power, 0, maxPower);
    car.reverse = clamp(car.reverse, 0, maxReverse);

    const direction = car.power > car.reverse ? 1 : -1;

    if (car.isTurningLeft) {
      car.angularVelocity -= direction * turnSpeed * car.isTurningLeft;
    }
    if (car.isTurningRight) {
      car.angularVelocity += direction * turnSpeed * car.isTurningRight;
    }

    car.xVelocity += Math.sin(car.angle) * (car.power - car.reverse);
    car.yVelocity += Math.cos(car.angle) * (car.power - car.reverse);

    car.x += car.xVelocity;
    car.y -= car.yVelocity;
    car.xVelocity *= drag;
    car.yVelocity *= drag;
    car.angle += car.angularVelocity;
    car.angularVelocity *= angularDrag;

    if (car.isShooting && !car.isShot && !car.isHit) {
      if (!car.lastShootAt || car.lastShootAt < Date.now() - 1000) {
        car.lastShootAt = Date.now();
        const { x, y, angle, xVelocity, yVelocity } = car;
        const shot = {
          local: car === localCar,
          x,
          y,
          angle,
        };
        const count = Math.round(Math.random() * 20) + 10;
        bullets.push(
          ...Array(count)
            .fill()
            .map(() => ({
              ...shot,
              xVelocity:
                xVelocity +
                Math.sin(angle + Math.random() - 0.5) * Math.random() * 1.25,
              yVelocity:
                yVelocity +
                Math.cos(angle + Math.random() - 0.5) * Math.random() * 1.25,
              shootAt: Date.now() + Math.random() * 500,
            }))
        );
      }
    }
  }

  function update() {
    cars.forEach(updateCar);

    for (let i = 0; i < bullets.length; i++) {
      const bullet = bullets[i];

      bullet.x += bullet.xVelocity;
      bullet.y -= bullet.yVelocity;
    }
  }

  let lastTime;
  let acc = 0;
  const step = 1 / 120;

  setInterval(() => {
    let changed;

    const canTurn = localCar.power > 0.0025 || localCar.reverse;

    const controls =
      localCar.name != null
        ? window.getControls()
        : {
            up: 0,
            left: 0,
            right: 0,
            down: 0,
            shoot: 0,
          };

    const throttle = Math.round(controls.up * 10) / 10;
    const reverse = Math.round(controls.down * 10) / 10;
    const isShooting = controls.shoot;

    if (isShooting !== localCar.isShooting) {
      changed = true;
      localCar.isShooting = isShooting;
    }

    if (
      localCar.isThrottling !== throttle ||
      localCar.isReversing !== reverse
    ) {
      changed = true;
      localCar.isThrottling = throttle;
      localCar.isReversing = reverse;
    }
    const turnLeft = canTurn && Math.round(controls.left * 10) / 10;
    const turnRight = canTurn && Math.round(controls.right * 10) / 10;

    if (localCar.isTurningLeft !== turnLeft) {
      changed = true;
      localCar.isTurningLeft = turnLeft;
    }
    if (localCar.isTurningRight !== turnRight) {
      changed = true;
      localCar.isTurningRight = turnRight;
    }

    if (localCar.x > WIDTH + 7.5) {
      localCar.x -= WIDTH + 15;
      changed = true;
    } else if (localCar.x < -7.5) {
      localCar.x += WIDTH + 15;
      changed = true;
    }

    if (localCar.y > HEIGHT + 7.5) {
      localCar.y -= HEIGHT + 15;
      changed = true;
    } else if (localCar.y < -7.5) {
      localCar.y += HEIGHT + 15;
      changed = true;
    }

    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];

      if (localCar === car) {
        continue;
      }

      if (car.isShot) {
        continue;
      }

      if (
        circlesHit(
          { x: car.x, y: car.y, r: 7.5 },
          { x: localCar.x, y: localCar.y, r: 7.5 }
        )
      ) {
        localCar.isHit = true;
        changed = true;
      }
    }

    for (let j = 0; j < cars.length; j++) {
      const car = cars[j];

      for (let i = 0; i < bullets.length; i++) {
        const bullet = bullets[i];

        if (
          bullet &&
          circlesHit(
            { x: car.x, y: car.y, r: 7.5 },
            { x: bullet.x, y: bullet.y, r: 2 }
          )
        ) {
          if (car !== localCar && !car.isShot) {
            car.isShot = true;
            changed = true;
            if (bullet.local) {
              localCar.points++;
            }
          }
        }
      }
    }

    const ms = Date.now();
    if (lastTime) {
      acc += (ms - lastTime) / 1000;

      while (acc > step) {
        update();

        acc -= step;
      }
    }

    lastTime = ms;

    if (changed) {
      sendParams(localCar);
    }
  }, 1000 / 120);

  function renderCar(car, index) {
    const {
      x,
      y,
      angle,
      power,
      reverse,
      angularVelocity,

      xVelocity,
      yVelocity,
      isHit,
    } = car;

    if (!car.$body) {
      car.$body = car.$el.querySelector(".car-body");
    }

    if (!car.$name) {
      car.$name = car.$el.querySelector(".car-name");
    }

    if (DEBUG) {
      const $debug = car.$el.querySelector(".car-debug");
      if ($debug) {
        $debug.innerHTML = debug({
          isHit,
          x: x.toFixed(0),
          y: y.toFixed(0),
          angle: angle.toFixed(2),
          power: power.toFixed(2),
          angularVelocity: angularVelocity.toFixed(2),
          xVelocity: xVelocity.toFixed(2),
          yVelocity: yVelocity.toFixed(2),
        });
      }
    }

    car.$el.style.transform = `translate(${x}px, ${y}px)`;
    car.$body.style.transform = `rotate(${(angle * 180) / Math.PI}deg)`;
    car.$name.textContent = car.name || "";

    if (car.isShot) {
      car.$body.classList.add("shot");
    } else {
      car.$body.classList.remove("shot");
    }

    if (power > 0.0025 || reverse) {
      if (
        (maxReverse === reverse || maxPower === power) &&
        Math.abs(angularVelocity) < 0.002
      ) {
        return;
      }
      ctx.fillRect(
        x -
          Math.cos(angle + (3 * Math.PI) / 2) * 3 +
          Math.cos(angle + (2 * Math.PI) / 2) * 3,
        y -
          Math.sin(angle + (3 * Math.PI) / 2) * 3 +
          Math.sin(angle + (2 * Math.PI) / 2) * 3,
        1,
        1
      );
      ctx.fillRect(
        x -
          Math.cos(angle + (3 * Math.PI) / 2) * 3 +
          Math.cos(angle + (4 * Math.PI) / 2) * 3,
        y -
          Math.sin(angle + (3 * Math.PI) / 2) * 3 +
          Math.sin(angle + (4 * Math.PI) / 2) * 3,
        1,
        1
      );
    }

    if (car !== localCar) {
      const angle = Math.atan2(car.y - localCar.y, car.x - localCar.x);

      let $mapitem = $map.childNodes[index - 1];

      if (!$mapitem) {
        $mapitem = document.createElement("div");
        $mapitem.classList.add("map-item");
        $map.appendChild($mapitem);
      }

      const x = localCar.x + Math.cos(angle) * 12.5;
      const y = localCar.y + Math.sin(angle) * 12.5;

      $mapitem.style.transform = `translate(${x}px, ${y}px)`;
    }
  }

  function render(ms) {
    requestAnimationFrame(render);

    $points.textContent = cars
      .slice()
      .sort((a, b) => (b.points || 0) - (a.points || 0))
      .map((car) => {
        return [car.name || "anonymous", car.points || 0].join(": ");
      })
      .join("\n");

    cars.forEach(renderCar);

    while ($map.childNodes.length > cars.length - 1) {
      $map.removeChild($map.childNodes[$map.childNodes.length - 1]);
    }

    const now = Date.now();

    for (let i = 0; i < bullets.length; i++) {
      const bullet = bullets[i];
      const { x, y, shootAt } = bullet;
      if (!bullet.$el) {
        const $el = (bullet.$el = document.createElement("div"));
        $el.classList.add("bullet");
        const $confetti = document.createElement("div");
        $confetti.classList.add("confetti");
        $confetti.style.animationDelay = `-${Math.random() * 0.5}s`;
        $confetti.style.background =
          colors[Math.floor(Math.random() * colors.length)];
        $el.appendChild($confetti);

        $bullets.appendChild($el);
      }
      bullet.$el.style.transform = `translate(${x}px, ${y}px)`;

      if (shootAt < now - 300) {
        if (bullet.$el) {
          $bullets.removeChild(bullet.$el);
          bullets.splice(i--, 1);
        }
      }
    }

    scene.x = window.innerWidth / 2 - localCar.x;
    scene.y = window.innerHeight / 2 - localCar.y;

    $scene.style.transform = `translate(${scene.x}px, ${scene.y}px)`;
  }

  requestAnimationFrame(render);

  const socket = io("https://car-ws.vgood.science", {
    withCredentials: true,
  });

  socket.on("connect", () => {
    sendParams(localCar);
  });

  socket.on("join", () => {
    sendParams(localCar);
  });

  socket.on("params", ({ id, params }) => {
    let car = carsById[id];

    if (!car) {
      const $el = document.createElement("div");
      $el.classList.add("car");
      const $body = document.createElement("div");
      $body.classList.add("car-body");
      const $roof = document.createElement("div");
      $roof.classList.add("car-roof");
      const $name = document.createElement("div");
      $name.classList.add("car-name");
      $body.appendChild($roof);
      $el.appendChild($body);
      $el.appendChild($name);
      if (DEBUG) {
        const $debug = document.createElement("div");
        $debug.classList.add("car-debug");
        $el.appendChild($debug);
      }
      $cars.appendChild($el);
      car = {
        $el,
      };
      carsById[id] = car;
      cars.push(car);
    }

    for (const key in params) {
      if (key !== "el") {
        car[key] = params[key];
      }
    }
  });

  socket.on("leave", (id) => {
    const car = carsById[id];

    if (!car) {
      return console.error("Car not found");
    }

    for (let i = 0; i < cars.length; i++) {
      if (cars[i] === car) {
        cars.splice(i, 1);
        break;
      }
    }

    if (car.$el.parentNode) {
      car.$el.parentNode.removeChild(car.$el);
    }
    delete carsById[id];
  });

  function sendParams(car) {
    const {
      x,
      y,
      xVelocity,
      yVelocity,
      power,
      reverse,
      angle,
      angularVelocity,
      isThrottling,
      isReversing,
      isShooting,
      isTurningLeft,
      isTurningRight,
      isHit,
      isShot,
      name,
      points,
    } = car;

    socket.emit("params", {
      x,
      y,
      xVelocity,
      yVelocity,
      power,
      reverse,
      angle,
      angularVelocity,
      isThrottling,
      isReversing,
      isShooting,
      isTurningLeft,
      isTurningRight,
      isHit,
      isShot,
      name,
      points,
    });
  }

  const $disconnect = document.querySelector(".disconnect");

  $disconnect.onclick = () => {
    socket.disconnect();

    localCar.name = "";

    while (cars.length > 1) {
      const car = cars.pop();

      car.$el.parentNode.removeChild(car.$el);
    }

    $disconnect.parentNode.removeChild($disconnect);
  };

  const $clearScreen = document.querySelector(".clearscreen");

  $clearScreen.onclick = () => {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
  };

  setInterval(() => {
    ctx.fillStyle = "hsla(0, 0%, 95%, 0.2)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "hsla(0, 0%, 25%, 0.5)";
  }, 15 * 1000);

  function circlesHit({ x: x1, y: y1, r: r1 }, { x: x2, y: y2, r: r2 }) {
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)) < r1 + r2;
  }

  const $name = document.querySelector(".name");

  $name.querySelector("form").onsubmit = (e) => {
    e.preventDefault();

    localCar.name = $name.querySelector("input").value || "";

    $name.parentNode.removeChild($name);
  };

  if (DEBUG) {
    const $body = document.querySelector("body");
    $body.classList.add("debug");
  }
})();

function debug(object) {
  return Object.entries(object)
    .map(([key, value]) => {
      return `${key}: ${value}`;
    })
    .join("<br />");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const colors = [
  "#fc0120",
  "#8257e6",
  "#ffbf4d",
  "#fe5d7a",
  "#45ec9c",
  "#f6e327",
  "#f769ce",
  "#007de7",
  "#63b4fc",
  "#f9c4ea",
];

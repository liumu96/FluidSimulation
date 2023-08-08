const config = {
  SIM_RESOLUTION: 128,
  DYE_RESOLUTION: 1024,
  CAPTURE_RESOLUTION: 512,
  DENSITY_DISSIPATION: 1,
  VELOCITY_DISSIPATION: 0.2,
  PRESSURE: 0.8,
  PRESSURE_ITERATIONS: 20,
  CURL: 30,
  SPLAT_RADIUS: 0.25,
  SPLAT_FORCE: 6000,
  SHADING: true,
  COLORFUL: true,
  COLOR_UPDATE_SPEED: 10,
  PAUSED: false,
  BACK_COLOR: { r: 0, g: 0, b: 0 },
  TRANSPARENT: false,
  BLOOM: true,
  BLOOM_ITERATIONS: 8,
  BLOOM_RESOLUTION: 256,
  BLOOM_INTENSITY: 0.8,
  BLOOM_THRESHOLD: 0.6,
  BLOOM_SOFT_KNEE: 0.7,
  SUNRAYS: true,
  SUNRAYS_RESOLUTION: 196,
  SUNRAYS_WEIGHT: 1.0,
};

if (isMobile()) {
  config.DYE_RESOLUTION = 512;
}
if (!ext.supportLinearFiltering) {
  config.DYE_RESOLUTION = 512;
  config.SHADING = false;
  config.BLOOM = false;
  config.SUNRAYS = false;
}

startGUI();

/************** Utils Function **************/
function startGUI() {
  const gui = new dat.GUI({ width: 300 });
  gui
    .add(config, "DYE_RESOLUTION", {
      high: 1024,
      medium: 512,
      low: 256,
      "very low": 128,
    })
    .name("quality")
    .onFinishChange(initFramebuffers);
  gui
    .add(config, "SIM_RESOLUTION", { 32: 32, 64: 64, 128: 128, 256: 256 })
    .name("sim resolution")
    .onFinishChange(initFramebuffers);
  gui.add(config, "DENSITY_DISSIPATION", 0, 4.0).name("density diffusion");
  gui.add(config, "VELOCITY_DISSIPATION", 0, 4.0).name("velocity diffusion");
  gui.add(config, "PRESSURE", 0.0, 1.0).name("pressure");
  gui.add(config, "CURL", 0, 50).name("vorticity").step(1);
  gui.add(config, "SPLAT_RADIUS", 0.01, 1.0).name("splat radius");
  gui.add(config, "SHADING").name("shading").onFinishChange(updateKeywords);
  gui.add(config, "COLORFUL").name("colorful");
  gui.add(config, "PAUSED").name("paused").listen();

  gui
    .add(
      {
        fun: () => {
          splatStack.push(parseInt(Math.random() * 20) + 5);
        },
      },
      "fun"
    )
    .name("Random splats");

  let bloomFolder = gui.addFolder("Bloom");
  bloomFolder
    .add(config, "BLOOM")
    .name("enabled")
    .onFinishChange(updateKeywords);
  bloomFolder.add(config, "BLOOM_INTENSITY", 0.1, 2.0).name("intensity");
  bloomFolder.add(config, "BLOOM_THRESHOLD", 0.0, 1.0).name("threshold");

  let sunraysFolder = gui.addFolder("Sunrays");
  sunraysFolder
    .add(config, "SUNRAYS")
    .name("enabled")
    .onFinishChange(updateKeywords);
  sunraysFolder.add(config, "SUNRAYS_WEIGHT", 0.3, 1.0).name("weight");

  let captureFolder = gui.addFolder("Capture");
  captureFolder.addColor(config, "BACK_COLOR").name("background color");
  captureFolder.add(config, "TRANSPARENT").name("transparent");
  captureFolder.add({ fun: captureScreenshot }, "fun").name("take screenshot");

  let app = gui
    .add(
      {
        fun: () => {
          ga("send", "event", "link button", "app");
          window.open("http://onelink.to/5b58bn");
        },
      },
      "fun"
    )
    .name("Check out mobile app");
  app.__li.className = "cr function appBigFont";
  app.__li.style.borderLeft = "3px solid #00FF7F";
  let appIcon = document.createElement("span");
  app.domElement.parentElement.appendChild(appIcon);
  appIcon.className = "icon app";

  if (isMobile()) gui.close();
}

function isMobile() {
  return /Mobi|Android/i.test(navigator.userAgent);
}

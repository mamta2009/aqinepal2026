module.exports = {
  apps: [
    {
      name: "climate-compass-nextjs",
      cwd: "/home/intelladapt/aqinepal2026/early-warning-system/frontend",
      script: "yarn",
      args: "start",
      env: {
        PORT: 3000, // Default port for development
        NODE_ENV: "development",
      },
      env_production: {
        PORT: 3012, // Production port
        NODE_ENV: "production",
      },
    },
  ],
};

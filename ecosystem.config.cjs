module.exports = {
  apps: [
    {
      name: 'manju-web',
      cwd: '/home/ugaws/manju-web',
      script: 'pnpm',
      args: 'dev',
      interpreter: 'none',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS Z',
      max_restarts: 20,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
}

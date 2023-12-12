import { default as configure }  from '@statewalker/rollup';
const configs = configure(import.meta);
configs.forEach(config => {
  config.external = [];
});
export default configs;

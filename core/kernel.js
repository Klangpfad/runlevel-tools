import api from "./api.js";
import state from "./state.js";
import router from "./router.js";

const Kernel = {
  api,
  state,
  router,
  init() {
    return Kernel;
  },
};

window.RunlevelKernel = Kernel;

export default Kernel;

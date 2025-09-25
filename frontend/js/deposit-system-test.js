// Minimal test script
console.log("TEST SCRIPT: Loading");
window.TEST_LOADED = true;
window.depositSystem = {
  showModal: () => console.log("Test showModal"),
  closeModal: () => console.log("Test closeModal"),
  hasDeposited: () => Promise.resolve(false),
  isInitialized: () => true
};
console.log("TEST SCRIPT: Complete");
window.onload = function() {
  document.querySelector("body").classList.remove("loading");
};

var counter = 10;

var timer = window.setInterval(function() {
  counter--;
  updateCounter();
  if (counter === 0) finishTimer();
}, 1000);

function updateCounter() {
  document.querySelector(".connections-timer-counter").innerHTML = counter;
}

function finishTimer() {
  window.clearInterval(timer);
  document.querySelector(".connections-timer").classList.add("ended");
  document.querySelector(".connections-content").classList.remove("blurred");
}

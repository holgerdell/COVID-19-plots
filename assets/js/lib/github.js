"use strict";

const github = (() => {
  const API = "https://api.github.com";
  const RAW = "https://raw.githubusercontent.com";

  const raw_url = (owner, repo, path) => `${RAW}/${owner}/${repo}/master/${path}`;
  const api_contents_url = (owner, repo, path) => `${API}/repos/${owner}/${repo}/contents/${path}`;

  function logAPIRequest ( event ) {

      var log = document.getElementById("log") ;
      log.classList.remove("status-pending");

      var last = (new Date()).toString();
      var status = event.target.status ;
      var statusText = event.target.statusText ;
      var reset = event.target.getResponseHeader("X-RateLimit-Reset") ;
      var limit = event.target.getResponseHeader("X-RateLimit-Limit") ;
      var remaining = event.target.getResponseHeader("X-RateLimit-Remaining") ;
      reset = new Date( parseInt(reset) * 1000 ).toString() ;
      limit = parseInt( limit ) ;
      remaining = parseInt( remaining ) ;

      document.getElementById("log-last").innerText = last ;
      document.getElementById("log-status").innerText = status ;
      document.getElementById("log-status-text").innerText = statusText ;
      document.getElementById("log-reset").innerText = reset ;
      document.getElementById("log-limit").innerText = limit;
      document.getElementById("log-remaining").innerText = remaining ;

      if ( status !== 200 ) {
          log.classList.add("status-error");
          console.error("There was a problem with the request.", event);
          console.error( status , statusText ) ;
          try{
              var message = JSON.parse(event.target.responseText).message ;
              document.getElementById("log-message").innerText = message ;
              console.error( "response is", message);
          }
          catch (e){
              console.error( "response is not in JSON format");
              console.error( "responce is", event.target.responseText);
          }
      }
      else {
          log.classList.add("status-ok");
      }
  }

  function logRAWRequest ( event ) {
      var status = event.target.status ;
      var statusText = event.target.statusText ;

      if ( status !== 200 ) {
          console.error("There was a problem with the request.", event);
          console.error( status , statusText ) ;
          console.error( "response is", event.target.responseText);
      }
      else {
          console.debug( status , statusText ) ;
      }
  }

  return {
    //API,
    //RAW,
    raw_url,
    //api_contents,
    logRAWRequest,
    //logAPIRequest,
  } ;

})();

document
  .getElementById("search-button")
  .addEventListener("click", async function () {
    const query = document.getElementById("query").value;
    if (query) {
      fetch("http://localhost:5000/get/response", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: query }), // Correct structure
      })
        .then((response) => response.json()) // Parse the JSON response
        .then((data) => {
          console.log("Success:", data);
          // Update the UI with the returned data
          document.getElementById("answer-box").textContent = data.response; // Correct key
        })
        .catch((error) => {
          console.error("Error:", error);
          document.getElementById("answer-box").textContent =
            "An error occurred. Please try again.";
        });
    }
  });

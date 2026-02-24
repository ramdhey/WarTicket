const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

async function test() {
  const form = new FormData();
  form.append("name", "Test Avatar User");
  form.append("email", `test-${Date.now()}@example.com`);
  form.append("password", "password123");

  // Create a dummy image
  fs.writeFileSync("dummy.jpg", "dummy image content");
  form.append("avatar", fs.createReadStream("dummy.jpg"));

  try {
    const res = await axios.post("http://local//api/auth/register", form, {
      headers: form.getHeaders(),
    });
    console.log("Registration success:", res.data.data.user);
  } catch (err) {
    console.error("Registration failed:", err.response?.data || err.message);
  }
}
test();

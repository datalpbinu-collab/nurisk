// services/api.js
import axios from "axios"

const api = axios.create({
  baseURL: "https://nupeduli-pusdatin-nu-backend.hf.space" // backend kamu
})

export default api
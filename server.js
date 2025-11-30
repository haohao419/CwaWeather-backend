require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// CWA API 設定
const CWA_API_BASE_URL = "https://opendata.cwa.gov.tw/api";
const CWA_API_KEY = process.env.CWA_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 城市對應表
const CITY_MAP = {
  taipei: "臺北市",
  newtaipei: "新北市",
  taoyuan: "桃園市",
  taichung: "臺中市",
  tainan: "臺南市",
  kaohsiung: "高雄市",
};

/**
 * 通用天氣預報取得函數
 * @param {string} cityName - 城市中文名稱
 */
const getWeatherData = async (cityName) => {
  // 檢查是否有設定 API Key
  if (!CWA_API_KEY) {
    throw new Error("請在 .env 檔案中設定 CWA_API_KEY");
  }

  // 呼叫 CWA API - 一般天氣預報（36小時）
  // API 文件: https://opendata.cwa.gov.tw/dist/opendata-swagger.html
  const response = await axios.get(
    `${CWA_API_BASE_URL}/v1/rest/datastore/F-C0032-001`,
    {
      params: {
        Authorization: CWA_API_KEY,
        locationName: cityName,
      },
    }
  );

  // 取得城市的天氣資料
  const locationData = response.data.records.location[0];

  if (!locationData) {
    throw new Error(`無法取得${cityName}天氣資料`);
  }

  // 整理天氣資料
  const weatherData = {
    city: locationData.locationName,
    updateTime: response.data.records.datasetDescription,
    forecasts: [],
  };

  // 解析天氣要素
  const weatherElements = locationData.weatherElement;
  const timeCount = weatherElements[0].time.length;

  for (let i = 0; i < timeCount; i++) {
    const forecast = {
      startTime: weatherElements[0].time[i].startTime,
      endTime: weatherElements[0].time[i].endTime,
      weather: "",
      rain: "",
      minTemp: "",
      maxTemp: "",
      comfort: "",
      windSpeed: "",
    };

    weatherElements.forEach((element) => {
      const value = element.time[i].parameter;
      switch (element.elementName) {
        case "Wx":
          forecast.weather = value.parameterName;
          break;
        case "PoP":
          forecast.rain = value.parameterName + "%";
          break;
        case "MinT":
          forecast.minTemp = value.parameterName + "°C";
          break;
        case "MaxT":
          forecast.maxTemp = value.parameterName + "°C";
          break;
        case "CI":
          forecast.comfort = value.parameterName;
          break;
        case "WS":
          forecast.windSpeed = value.parameterName;
          break;
      }
    });

    weatherData.forecasts.push(forecast);
  }

  return weatherData;
};

/**
 * 通用天氣預報 API Handler
 */
const getCityWeather = (cityKey) => {
  return async (req, res) => {
    try {
      const cityName = CITY_MAP[cityKey];
      const weatherData = await getWeatherData(cityName);

      res.json({
        success: true,
        data: weatherData,
      });
    } catch (error) {
      console.error(`取得${CITY_MAP[cityKey]}天氣資料失敗:`, error.message);

      if (error.response) {
        // API 回應錯誤
        return res.status(error.response.status).json({
          error: "CWA API 錯誤",
          message: error.response.data.message || "無法取得天氣資料",
          details: error.response.data,
        });
      }

      // 其他錯誤
      res.status(500).json({
        error: "伺服器錯誤",
        message: error.message || "無法取得天氣資料,請稍後再試",
      });
    }
  };
};

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "歡迎使用 CWA 天氣預報 API - 六都天氣資訊",
    endpoints: {
      taipei: "/api/weather/taipei",
      newTaipei: "/api/weather/newtaipei",
      taoyuan: "/api/weather/taoyuan",
      taichung: "/api/weather/taichung",
      tainan: "/api/weather/tainan",
      kaohsiung: "/api/weather/kaohsiung",
      health: "/api/health",
    },
    cities: {
      taipei: "臺北市",
      newTaipei: "新北市",
      taoyuan: "桃園市",
      taichung: "臺中市",
      tainan: "臺南市",
      kaohsiung: "高雄市",
    },
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// 六都天氣預報路由
app.get("/api/weather/taipei", getCityWeather("taipei"));
app.get("/api/weather/newtaipei", getCityWeather("newtaipei"));
app.get("/api/weather/taoyuan", getCityWeather("taoyuan"));
app.get("/api/weather/taichung", getCityWeather("taichung"));
app.get("/api/weather/tainan", getCityWeather("tainan"));
app.get("/api/weather/kaohsiung", getCityWeather("kaohsiung"));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "伺服器錯誤",
    message: err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "找不到此路徑",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 伺服器運行已運作`);
  console.log(`📍 環境: ${process.env.NODE_ENV || "development"}`);
  console.log(`📡 支援城市: 臺北市、新北市、桃園市、臺中市、臺南市、高雄市`);
});
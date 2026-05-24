#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_netif.h"
#include "esp_http_client.h"

static const char *TAG = "IOT_PING";

// Configuration from menuconfig (idf.py menuconfig)
#define API_URL CONFIG_API_URL
#define WIFI_SSID CONFIG_WIFI_SSID
#define WIFI_PASS CONFIG_WIFI_PASSWORD

static bool wifi_connected = false;

static void wifi_event_handler(void *arg, esp_event_base_t event_base,
                               int32_t event_id, void *event_data)
{
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        ESP_LOGI(TAG, "Disconnected. Reconnecting...");
        wifi_connected = false;
        esp_wifi_connect();
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;
        ESP_LOGI(TAG, "Got IP: " IPSTR, IP2STR(&event->ip_info.ip));
        wifi_connected = true;
    }
}

static void wifi_init(void)
{
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    esp_event_handler_instance_t instance_any_id;
    esp_event_handler_instance_t instance_got_ip;
    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID,
                                                        &wifi_event_handler, NULL, &instance_any_id));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP,
                                                        &wifi_event_handler, NULL, &instance_got_ip));

    wifi_config_t wifi_config = {
        .sta = {
            .ssid = WIFI_SSID,
            .password = WIFI_PASS,
        },
    };
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(TAG, "WiFi initialization complete");
}

esp_err_t http_event_handler(esp_http_client_event_t *evt)
{
    switch (evt->event_id) {
        case HTTP_EVENT_ON_CONNECTED:
            ESP_LOGI(TAG, "HTTP Connected");
            break;
        case HTTP_EVENT_ON_DATA:
            ESP_LOGI(TAG, "HTTP Data received, len=%d", evt->data_len);
            break;
        case HTTP_EVENT_ON_FINISH:
            ESP_LOGI(TAG, "HTTP Finished");
            break;
        case HTTP_EVENT_ERROR:
            ESP_LOGE(TAG, "HTTP Error");
            break;
        default:
            break;
    }
    return ESP_OK;
}

static void ping_api(void)
{
    ESP_LOGI(TAG, "Pinging API: %s", API_URL);

    esp_http_client_config_t config = {
        .url = API_URL,
        .event_handler = http_event_handler,
        .timeout_ms = 5000,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);

    esp_err_t err = esp_http_client_perform(client);

    if (err == ESP_OK) {
        int status = esp_http_client_get_status_code(client);
        int content_length = esp_http_client_get_content_length(client);
        ESP_LOGI(TAG, "✓ API Ping successful! Status: %d, Content-Length: %d", status, content_length);
    } else {
        ESP_LOGE(TAG, "✗ API Ping failed: %s", esp_err_to_name(err));
    }

    esp_http_client_cleanup(client);
}

static void ping_task(void *pvParameters)
{
    while (1) {
        if (wifi_connected) {
            ping_api();
        } else {
            ESP_LOGW(TAG, "Waiting for WiFi connection...");
        }
        vTaskDelay(pdMS_TO_TICKS(10000)); // Ping every 10 seconds
    }
}

void app_main(void)
{
    ESP_LOGI(TAG, "IoT Dashboard Firmware - API Ping");

    // Initialize NVS
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    // Initialize WiFi
    wifi_init();

    // Create ping task
    xTaskCreate(ping_task, "ping_task", 8192, NULL, 5, NULL);
}

package com.iot.android.data

import android.content.Context

/**
 * Persists ThingsBoard auth tokens in SharedPreferences. Mirrors the
 * localStorage-backed store in ui/lib/auth.ts.
 */
object TokenStore {
    private const val PREFS = "tb_auth"
    private const val KEY_TOKEN = "token"
    private const val KEY_REFRESH = "refresh_token"

    fun save(context: Context, tokens: AuthTokens) {
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_TOKEN, tokens.token)
            .putString(KEY_REFRESH, tokens.refreshToken)
            .apply()
    }

    fun getToken(context: Context): String? =
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_TOKEN, null)

    fun clear(context: Context) {
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .clear()
            .apply()
    }
}

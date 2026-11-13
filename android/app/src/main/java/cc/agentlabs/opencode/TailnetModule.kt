package cc.agentlabs.opencode

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import org.json.JSONArray
import org.json.JSONObject

/**
 * Built-in Tailscale: a userspace tailnet node inside the app (tsnetbridge.aar), so the phone reaches
 * the computer without the Tailscale app and without taking the single Android VPN slot.
 * JS asks for a local forward 127.0.0.1:<port> -> <tailnet host>:<port> and talks to that.
 */
class TailnetModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  private val pool = Executors.newSingleThreadExecutor()
  private val forwards = ConcurrentHashMap<String, Int>()

  override fun getName() = "Tailnet"

  private val available: Boolean by lazy {
    runCatching { Class.forName("tsnetbridge.Tsnetbridge"); tsnetbridge.Tsnetbridge.ready(); true }.getOrDefault(false)
  }

  private fun run(promise: Promise, block: () -> Any?) {
    pool.execute {
      try {
        if (!available) promise.reject("unavailable", "Built-in Tailscale is not available on this device")
        else promise.resolve(block())
      } catch (e: Throwable) {
        promise.reject("tailnet", e.message ?: e.toString())
      }
    }
  }

  @ReactMethod fun isAvailable(promise: Promise) { pool.execute { promise.resolve(available) } }

  @ReactMethod fun start(hostname: String, promise: Promise) = run(promise) {
    // Android 11+ hides the interface list from netlink, so the app passes it in (same as the official client).
    tsnetbridge.Tsnetbridge.setInterfaces(interfacesJson())
    val dir = ctx.filesDir.resolve("tailnet").apply { mkdirs() }
    tsnetbridge.Tsnetbridge.start(dir.absolutePath, hostname)
    null
  }

  @ReactMethod fun status(promise: Promise) = run(promise) {
    Arguments.createMap().apply {
      putBoolean("ready", tsnetbridge.Tsnetbridge.ready())
      putString("authUrl", tsnetbridge.Tsnetbridge.authURL().orEmpty())
      putString("ip", tsnetbridge.Tsnetbridge.selfIP().orEmpty())
      putString("error", tsnetbridge.Tsnetbridge.lastError().orEmpty())
    }
  }

  /** target is "host:port"; resolves the local port of the forward (reused for the same target). */
  @ReactMethod fun forward(target: String, promise: Promise) = run(promise) {
    forwards.getOrPut(target) { tsnetbridge.Tsnetbridge.forward(target).toInt() }
  }

  @ReactMethod fun refreshNetwork(promise: Promise) = run(promise) {
    tsnetbridge.Tsnetbridge.setInterfaces(interfacesJson()); null
  }

  @ReactMethod fun logout(promise: Promise) = run(promise) {
    tsnetbridge.Tsnetbridge.logout(); null
  }

  @ReactMethod fun stop(promise: Promise) = run(promise) {
    forwards.clear(); tsnetbridge.Tsnetbridge.stop(); null
  }

  @ReactMethod fun logTail(lines: Int, promise: Promise) = run(promise) {
    tsnetbridge.Tsnetbridge.logTail(lines.toLong()).orEmpty()
  }

  /** Online devices of the tailnet as JSON [{"name","ip"}]: used to find the computer when pairing with a code. */
  @ReactMethod fun peers(promise: Promise) = run(promise) {
    tsnetbridge.Tsnetbridge.peers().orEmpty()
  }

  /** IPv4 addresses of this phone as "ip/prefix", Wi-Fi first. Needs no Tailscale library. */
  @ReactMethod fun localAddresses(promise: Promise) {
    pool.execute {
      val out = Arguments.createArray()
      runCatching {
        java.net.NetworkInterface.getNetworkInterfaces()?.toList().orEmpty()
          .filter { runCatching { it.isUp && !it.isLoopback }.getOrDefault(false) }
          .sortedBy { !it.name.startsWith("wlan") }
          .forEach { n ->
            n.interfaceAddresses.forEach { ia ->
              val address = ia.address
              if (address is java.net.Inet4Address) out.pushString("${address.hostAddress}/${ia.networkPrefixLength}")
            }
          }
      }
      promise.resolve(out)
    }
  }

  private fun interfacesJson(): String = runCatching {
    val arr = JSONArray()
    java.net.NetworkInterface.getNetworkInterfaces()?.toList().orEmpty().forEach { n ->
      arr.put(
        JSONObject().put("name", n.name).put("index", n.index).put("mtu", runCatching { n.mtu }.getOrDefault(1500))
          .put("up", runCatching { n.isUp }.getOrDefault(false)).put("loopback", runCatching { n.isLoopback }.getOrDefault(false))
          .put("p2p", runCatching { n.isPointToPoint }.getOrDefault(false))
          .put("multicast", runCatching { n.supportsMulticast() }.getOrDefault(false))
          .put("addrs", JSONArray(n.interfaceAddresses.mapNotNull { ia ->
            ia.address?.hostAddress?.substringBefore('%')?.let { "$it/${ia.networkPrefixLength}" }
          }))
      )
    }
    arr.toString()
  }.getOrDefault("")
}

class TailnetPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(TailnetModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}

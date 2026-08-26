/**
 * Google Maps Distance Matrix Helper
 * Computes driving distance (km) between School and Stop/Student address.
 * Falls back to null / graceful manual override if Google Maps API key is unconfigured.
 */
export async function calculateDrivingDistanceKm(
  origin: string,
  destination: string
): Promise<{ distanceKm: number | null; formattedDistance?: string; durationText?: string; error?: string }> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey || apiKey === "AIzaSy_demo_placeholder" || apiKey === "your-google-maps-api-key") {
    return {
      distanceKm: null,
      error: "Google Maps API Key not configured. Please enter distance in kilometers manually.",
    };
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    url.searchParams.append("origins", origin);
    url.searchParams.append("destinations", destination);
    url.searchParams.append("mode", "driving");
    url.searchParams.append("key", apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === "OK" && data.rows?.[0]?.elements?.[0]?.status === "OK") {
      const element = data.rows[0].elements[0];
      const distanceInMeters = element.distance.value;
      const distanceKm = Number((distanceInMeters / 1000).toFixed(2));
      return {
        distanceKm,
        formattedDistance: element.distance.text,
        durationText: element.duration.text,
      };
    }

    return {
      distanceKm: null,
      error: data.error_message || "Could not calculate driving distance between points.",
    };
  } catch (err: any) {
    return {
      distanceKm: null,
      error: err.message || "Failed to reach Google Maps service.",
    };
  }
}

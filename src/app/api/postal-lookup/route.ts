export async function GET(request: Request) {
  const pin = new URL(request.url).searchParams.get('pin') ?? '';
  if (!/^[1-9][0-9]{5}$/.test(pin)) return Response.json({}, { status: 400 });

  try {
    const response = await fetch('https://api.postalpincode.in/pincode/' + pin, {
      signal: AbortSignal.timeout(850),
      next: { revalidate: 86400 },
    });
    if (!response.ok) throw new Error('Postal service unavailable');
    const result = await response.json();
    const office = result?.[0]?.PostOffice?.[0];
    if (!office?.District || !office?.State) return Response.json({}, { status: 404 });
    return Response.json({ city: office.District, state: office.State }, {
      headers: { 'Cache-Control': 'public, max-age=86400' },
    });
  } catch {
    return Response.json({}, { status: 503 });
  }
}

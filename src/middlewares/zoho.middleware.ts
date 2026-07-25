import { NextFunction, Request, Response } from "express";

let expiryDate = 0;
let access_token = '';

export async function refreshZohoAccessToken() {
    if (expiryDate && expiryDate > Date.now() && access_token) {
        return `Bearer ${access_token}`;
    }

    const cliendId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;

    const params = new URLSearchParams({
        client_id: cliendId!,
        client_secret: clientSecret!,
        refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
        grant_type: 'refresh_token',
    });

    const response = await fetch(`https://accounts.zoho.sa/oauth/v2/token?${params}`, {
        method: 'POST',
    });

    const data = await response.json();
    if (data.hasOwnProperty('error')) {
        console.error("Error refreshing Zoho token:", data);
        throw new Error(data.error_description || "Unknown error");
    }

    access_token = data.access_token;
    expiryDate = Date.now() + data.expires_in * 1000;

    return `Bearer ${access_token}`;
}

export async function refreshZohoToken(req: Request, _: Response, next: NextFunction) {
    try {
        req.headers['Authorization'] = await refreshZohoAccessToken();
        return next();
    } catch (error) {
        console.error(error);
        return next(error);
    }
}
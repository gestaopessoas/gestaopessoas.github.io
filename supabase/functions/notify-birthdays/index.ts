import { createClient } from "jsr:@supabase/supabase-js@2";
import * as nodemailer from "npm:nodemailer";

console.log("Hello from notify-birthdays!");

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    // Call our RPC to get birthdays/anniversaries for the current month
    const { data: employees, error } = await supabase.rpc("get_birthdays_by_month", {
      p_month: month,
    });

    if (error) {
      throw error;
    }

    // Filter to those happening exactly today
    const todayEvents = (employees || []).filter((emp: any) => {
      const isBirthday = emp.birthday && parseInt(emp.birthday.split("-")[2]) === day;
      const isAnniversary = emp.admission_date && parseInt(emp.admission_date.split("-")[2]) === day;
      return isBirthday || isAnniversary;
    });

    if (todayEvents.length === 0) {
      return new Response(JSON.stringify({ message: "No events today" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Setup nodemailer transport using Office365
    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false, // TLS
      auth: {
        user: Deno.env.get("SMTP_USER"),
        pass: Deno.env.get("SMTP_PASS"),
      },
    });

    let emailText = "Eventos de hoje:\n\n";
    todayEvents.forEach((emp: any) => {
      const isBirthday = emp.birthday && parseInt(emp.birthday.split("-")[2]) === day;
      const isAnniversary = emp.admission_date && parseInt(emp.admission_date.split("-")[2]) === day;
      
      if (isBirthday) {
        emailText += `- Feliz aniversário para ${emp.name}!\n`;
      }
      if (isAnniversary) {
        const admissionYear = parseInt(emp.admission_date.split("-")[0]);
        const years = today.getFullYear() - admissionYear;
        if (years > 0) {
          emailText += `- Feliz aniversário de empresa para ${emp.name} (${years} anos)!\n`;
        } else {
          emailText += `- Bem-vindo(a) à empresa, ${emp.name} (Admitido(a) hoje)!\n`;
        }
      }
    });

    const mailOptions = {
      from: Deno.env.get("SMTP_USER"),
      to: Deno.env.get("NOTIFY_EMAIL") || Deno.env.get("SMTP_USER"),
      subject: "Notificações de Aniversários e Admissões - " + today.toLocaleDateString(),
      text: emailText,
    };

    const info = await transporter.sendMail(mailOptions);

    return new Response(JSON.stringify({ message: "Emails sent successfully", info }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

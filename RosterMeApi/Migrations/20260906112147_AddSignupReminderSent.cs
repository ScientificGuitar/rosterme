using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RosterMeApi.Migrations
{
    /// <inheritdoc />
    public partial class AddSignupReminderSent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ReminderSentAt",
                table: "Signups",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Signups_Status_ReminderSentAt",
                table: "Signups",
                columns: new[] { "Status", "ReminderSentAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Signups_Status_ReminderSentAt",
                table: "Signups");

            migrationBuilder.DropColumn(
                name: "ReminderSentAt",
                table: "Signups");
        }
    }
}

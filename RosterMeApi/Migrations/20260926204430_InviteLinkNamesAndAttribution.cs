using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RosterMeApi.Migrations
{
    /// <inheritdoc />
    public partial class InviteLinkNamesAndAttribution : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "InviteLinkId",
                table: "Signups",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "InviteLinks",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "Invite link");

            migrationBuilder.CreateIndex(
                name: "IX_Signups_InviteLinkId",
                table: "Signups",
                column: "InviteLinkId");

            migrationBuilder.AddForeignKey(
                name: "FK_Signups_InviteLinks_InviteLinkId",
                table: "Signups",
                column: "InviteLinkId",
                principalTable: "InviteLinks",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Signups_InviteLinks_InviteLinkId",
                table: "Signups");

            migrationBuilder.DropIndex(
                name: "IX_Signups_InviteLinkId",
                table: "Signups");

            migrationBuilder.DropColumn(
                name: "InviteLinkId",
                table: "Signups");

            migrationBuilder.DropColumn(
                name: "Name",
                table: "InviteLinks");
        }
    }
}
